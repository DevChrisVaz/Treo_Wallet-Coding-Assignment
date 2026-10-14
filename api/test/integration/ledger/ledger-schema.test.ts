import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertOwnTransfer, insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

async function failure(promise: Promise<unknown>) {
  return (await promise.then(
    () => undefined,
    (e: unknown) => e,
  )) as { driverError?: { code?: string; constraint?: string } } | undefined;
}

/** Ejecuta sentencias en una transacción del rol de ejecución y devuelve el error del COMMIT. */
async function inTransaction(
  statements: (run: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<void>,
) {
  const runner = harness.app.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction();
    await statements((sql, params) => runner.query(sql, params));
    await runner.commitTransaction();
    return undefined;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    return error as { driverError?: { code?: string; constraint?: string } };
  } finally {
    await runner.release();
  }
}

const entry = `INSERT INTO ledger_entries (transfer_id, account_id, type, amount_cents, balance_after_cents, created_at)
               VALUES ($1, $2, $3, $4, $5, now())`;

describe('TRF-21 partida doble garantizada por la base', () => {
  it('TRF-21 dos asientos que suman cero en una transferencia COMPLETED se confirman', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const error = await inTransaction(async (run) => {
      const id = randomUUID();
      await run(
        `INSERT INTO transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                from_account_id, to_account_id, amount_cents, concept, reference,
                                requires_otp, created_at, completed_at)
         VALUES ($1, $2, $3, repeat('b', 64), 'OWN', 'COMPLETED', $4, $5, 500, 'Ahorro', 1, false,
                 now(), now())`,
        [id, ana.userId, randomUUID(), ana.principalId, ana.ahorroId],
      );
      await run(entry, [id, ana.principalId, 'OWN_TRANSFER_OUT', -500, 0]);
      await run(entry, [id, ana.ahorroId, 'OWN_TRANSFER_IN', 500, 500]);
    });
    expect(error).toBeUndefined();
  });

  it('TRF-21 asientos desbalanceados se rechazan al COMMIT y no queda ningún cambio', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const transferId = await insertOwnTransfer(harness.migrator, {
      userId: ana.userId,
      from: ana.principalId,
      to: ana.ahorroId,
      status: 'COMPLETED',
      amountCents: 500n,
    }).catch((e: unknown) => e);
    // Una COMPLETED sin asientos ya la rechaza el otro trigger; se arma todo en una transacción.
    expect(transferId).toMatchObject({
      driverError: { constraint: 'tg_transfers_completed_has_entries' },
    });

    const error = await inTransaction(async (run) => {
      const id = randomUUID();
      await run(
        `INSERT INTO transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                from_account_id, to_account_id, amount_cents, concept, reference,
                                requires_otp, created_at, completed_at)
         VALUES ($1, $2, $3, repeat('c', 64), 'OWN', 'COMPLETED', $4, $5, 500, 'Ahorro', 1, false,
                 now(), now())`,
        [id, ana.userId, randomUUID(), ana.principalId, ana.ahorroId],
      );
      await run(entry, [id, ana.principalId, 'OWN_TRANSFER_OUT', -500, 0]);
      await run(entry, [id, ana.ahorroId, 'OWN_TRANSFER_IN', 499, 499]);
    });
    expect(error?.driverError).toMatchObject({ code: '23514' });
    expect(['tg_ledger_entries_zero_sum', 'tg_transfers_completed_has_entries']).toContain(
      error?.driverError?.constraint,
    );
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.ledger_entries',
    );
    expect(n).toBe(0);
  });

  it('TRF-21 una transferencia que no está COMPLETED no puede tener asientos', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const transferId = await insertOwnTransfer(harness.migrator, {
      userId: ana.userId,
      from: ana.principalId,
      to: ana.ahorroId,
      status: 'PENDING_OTP',
      amountCents: 500n,
    });
    const error = await inTransaction(async (run) => {
      await run(entry, [transferId, ana.principalId, 'OWN_TRANSFER_OUT', -500, 0]);
      await run(entry, [transferId, ana.ahorroId, 'OWN_TRANSFER_IN', 500, 500]);
    });
    expect(error?.driverError).toMatchObject({
      code: '23514',
      constraint: 'tg_ledger_entries_zero_sum',
    });
  });

  it('TRF-21 una transferencia COMPLETED sin asientos se rechaza al COMMIT', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const error = await failure(
      insertOwnTransfer(harness.app, {
        userId: ana.userId,
        from: ana.principalId,
        to: ana.ahorroId,
        status: 'COMPLETED',
        amountCents: 100n,
      }),
    );
    expect(error?.driverError).toMatchObject({
      code: '23514',
      constraint: 'tg_transfers_completed_has_entries',
    });
  });
});

describe('TRF-07 y BEN-08 constraints de transferencias y beneficiarios', () => {
  it('TRF-07 ck_transfers_distinct_accounts impide origen y destino iguales', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const error = await failure(
      insertOwnTransfer(harness.app, {
        userId: ana.userId,
        from: ana.principalId,
        to: ana.principalId,
        status: 'PENDING_OTP',
        amountCents: 100n,
      }),
    );
    expect(error?.driverError).toMatchObject({
      code: '23514',
      constraint: 'ck_transfers_distinct_accounts',
    });
  });

  it('BEN-08 la base rechaza un beneficiario con CLABE de dígito verificador incorrecto', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const badClabe = `${luis.principalClabe.slice(0, 17)}${(Number(luis.principalClabe[17]) + 1) % 10}`;
    const error = await failure(
      harness.app.query(
        `INSERT INTO beneficiaries (id, user_id, account_id, name, alias, clabe)
         VALUES ($1, $2, $3, 'Luis', 'Luis', $4)`,
        [randomUUID(), ana.userId, luis.principalId, badClabe],
      ),
    );
    expect(error?.driverError ?? error).toMatchObject({
      code: '23514',
      constraint: 'ck_beneficiaries_clabe_valid',
    });
  });
});
