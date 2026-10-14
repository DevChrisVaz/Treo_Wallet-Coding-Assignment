import { describe, expect, it } from 'vitest';
import { insertRow, ownTransferRow, violation } from '../../helpers/db-constraints.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertOwnTransfer, insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

/** Asiento válido; cada caso cambia un solo campo. */
function entryRow(transferId: string, accountId: string, overrides: Record<string, unknown> = {}) {
  return {
    transfer_id: transferId,
    account_id: accountId,
    type: 'OWN_TRANSFER_OUT',
    amount_cents: -500,
    balance_after_cents: 0,
    created_at: new Date(),
    ...overrides,
  };
}

/** Ejecuta `statements` en una transacción del rol de ejecución; devuelve el error del COMMIT. */
async function inTransaction(
  statements: (
    insert: (table: string, row: Record<string, unknown>) => Promise<void>,
  ) => Promise<void>,
): Promise<Violation | undefined> {
  const runner = harness.app.createQueryRunner();
  await runner.connect();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const columns = Object.keys(row);
    await runner.query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row),
    );
  };
  try {
    await runner.startTransaction();
    await statements(insert);
    await runner.commitTransaction();
    return undefined;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    const raw = error as { driverError?: Violation } & Violation;
    return raw.driverError ?? raw;
  } finally {
    await runner.release();
  }
}

type Violation = NonNullable<Awaited<ReturnType<typeof violation>>>;

async function pendingTransfer() {
  const ana = await insertUserWithAccounts(harness.migrator);
  const transferId = await insertOwnTransfer(harness.migrator, {
    userId: ana.userId,
    from: ana.principalId,
    to: ana.ahorroId,
    status: 'PENDING_OTP',
    amountCents: 500n,
  });
  return { ana, transferId };
}

describe('TRF-21 constraints de ledger_entries por inserción directa', () => {
  it.each([
    ['tipo fuera del catálogo', { type: 'REFUND' }, 'ck_ledger_entries_type'],
    ['importe cero', { amount_cents: 0 }, 'ck_ledger_entries_amount_nonzero'],
  ])('TRF-21 rechaza un asiento con %s por %s', async (_label, overrides, constraint) => {
    const { ana, transferId } = await pendingTransfer();
    const error = await violation(
      insertRow(
        harness.app,
        'app.ledger_entries',
        entryRow(transferId, ana.principalId, overrides),
      ),
    );
    expect(error).toMatchObject({ code: '23514', constraint });
  });

  it('TRF-21 una cuenta no puede tener dos asientos en la misma transferencia', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const error = await inTransaction(async (insert) => {
      const transfer = ownTransferRow(ana, { status: 'COMPLETED', completed_at: new Date() });
      await insert('app.transfers', transfer);
      const id = transfer.id as string;
      await insert('app.ledger_entries', entryRow(id, ana.principalId));
      await insert('app.ledger_entries', entryRow(id, ana.principalId, { amount_cents: -100 }));
    });
    expect(error).toMatchObject({
      code: '23505',
      constraint: 'uq_ledger_entries_transfer_account',
    });
  });
});

describe('TRF-22 exactamente dos asientos por transferencia', () => {
  /** Importes (que suman cero) por cuenta: principal y ahorro de Ana y principal y ahorro de Luis. */
  it.each([
    ['tres asientos', [-500, 200, 300]],
    ['cuatro asientos', [-500, 500, -200, 200]],
  ])('TRF-22 %s que suman cero se rechazan al COMMIT', async (_label, amounts) => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const accounts = [ana.principalId, ana.ahorroId, luis.principalId, luis.ahorroId];
    const error = await inTransaction(async (insert) => {
      const transfer = ownTransferRow(ana, { status: 'COMPLETED', completed_at: new Date() });
      await insert('app.transfers', transfer);
      for (const [index, amount] of amounts.entries()) {
        await insert(
          'app.ledger_entries',
          entryRow(transfer.id as string, accounts[index] ?? '', {
            type: amount < 0 ? 'OWN_TRANSFER_OUT' : 'OWN_TRANSFER_IN',
            amount_cents: amount,
            balance_after_cents: Math.max(amount, 0),
          }),
        );
      }
    });
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(0);
    expect(error).toMatchObject({ code: '23514' });
    expect(['tg_ledger_entries_zero_sum', 'tg_transfers_completed_has_entries']).toContain(
      error?.constraint,
    );
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.ledger_entries',
    );
    expect(n).toBe(0);
  });
});

describe('TRF-22 control positivo', () => {
  it('TRF-22 dos asientos que suman cero en una COMPLETED se confirman', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const error = await inTransaction(async (insert) => {
      const transfer = ownTransferRow(ana, { status: 'COMPLETED', completed_at: new Date() });
      await insert('app.transfers', transfer);
      const id = transfer.id as string;
      await insert('app.ledger_entries', entryRow(id, ana.principalId));
      await insert(
        'app.ledger_entries',
        entryRow(id, ana.ahorroId, {
          type: 'OWN_TRANSFER_IN',
          amount_cents: 500,
          balance_after_cents: 500,
        }),
      );
    });
    expect(error).toBeUndefined();
  });
});
