import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { LedgerPoster } from '../../../src/modules/transfers/application/ledger-poster.js';
import {
  movementTypes,
  type LockedAccount,
  type TransferKind,
} from '../../../src/modules/transfers/domain/ledger.js';
import { PgLedgerStore } from '../../../src/modules/transfers/infrastructure/pg-ledger-store.js';
import {
  queryForUpdate,
  queryIn,
  TypeormTransactionRunner,
} from '../../../src/platform/persistence/transaction.js';
import { Money } from '../../../src/shared/money.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

/** Crea la transferencia provisional, bloquea ambas cuentas en orden de id y la asienta. */
async function post(
  kind: TransferKind,
  fromId: string,
  toId: string,
  amount: string,
  userId: string | null,
) {
  const runner = new TypeormTransactionRunner(harness.app);
  const poster = new LedgerPoster(new PgLedgerStore());
  return runner.run(async (tx) => {
    const transferId = randomUUID();
    await queryIn(
      tx,
      `INSERT INTO transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                              from_account_id, to_account_id, amount_cents, concept, reference,
                              requires_otp, created_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_OTP', $6, $7, $8, 'Prueba', 1, false, now())`,
      [
        transferId,
        userId,
        userId ? randomUUID() : null,
        userId ? 'e'.repeat(64) : null,
        kind,
        fromId,
        toId,
        Money.parse(amount).cents.toString(),
      ],
    );
    const rows = await queryForUpdate<{
      id: string;
      user_id: string | null;
      type: 'USER' | 'SYSTEM';
      balance_cents: string;
    }>(
      tx,
      `SELECT id, user_id, type, balance_cents FROM accounts WHERE id = ANY($1) ORDER BY id FOR NO KEY UPDATE`,
      [[fromId, toId]],
    );
    const locked = new Map<string, LockedAccount>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          userId: row.user_id,
          type: row.type,
          balance: Money.fromCents(BigInt(row.balance_cents)),
        },
      ]),
    );
    const at = new Date('2026-10-13T18:00:00.000Z');
    await poster.post(tx, {
      transferId,
      kind,
      from: locked.get(fromId) as LockedAccount,
      to: locked.get(toId) as LockedAccount,
      amount: Money.parse(amount),
      at,
    });
    return transferId;
  });
}

async function balance(accountId: string): Promise<string> {
  const [row] = await harness.migrator.query(
    'SELECT balance_cents FROM app.accounts WHERE id = $1',
    [accountId],
  );
  return row.balance_cents;
}

describe('TRF-21 servicio de asientos', () => {
  it('TRF-21 asienta dos movimientos que suman cero, actualiza saldos y completa la transferencia', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const transferId = await post('FUNDING', TREASURY_ACCOUNT_ID, ana.principalId, '1000.00', null);
    const entries = await harness.migrator.query(
      `SELECT account_id, type, amount_cents, balance_after_cents FROM app.ledger_entries
        WHERE transfer_id = $1 ORDER BY amount_cents`,
      [transferId],
    );
    expect(entries).toEqual([
      {
        account_id: TREASURY_ACCOUNT_ID,
        type: 'TRANSFER_OUT',
        amount_cents: '-100000',
        balance_after_cents: '-100000',
      },
      {
        account_id: ana.principalId,
        type: 'DEPOSIT',
        amount_cents: '100000',
        balance_after_cents: '100000',
      },
    ]);
    expect(await balance(ana.principalId)).toBe('100000');
    expect(await balance(TREASURY_ACCOUNT_ID)).toBe('-100000');
    const [transfer] = await harness.migrator.query(
      'SELECT status, completed_at FROM app.transfers WHERE id = $1',
      [transferId],
    );
    expect(transfer).toEqual({
      status: 'COMPLETED',
      completed_at: new Date('2026-10-13T18:00:00.000Z'),
    });
  });

  it('TRF-22 cada balance_after es el anterior más el monto: 1000.00, 800.00 y 500.00', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    await post('FUNDING', TREASURY_ACCOUNT_ID, ana.principalId, '1000.00', null);
    await post('OWN', ana.principalId, ana.ahorroId, '200.00', ana.userId);
    await post('OWN', ana.principalId, ana.ahorroId, '300.00', ana.userId);
    const chain = await harness.migrator.query(
      `SELECT type, amount_cents, balance_after_cents FROM app.ledger_entries
        WHERE account_id = $1 ORDER BY id`,
      [ana.principalId],
    );
    expect(chain).toEqual([
      { type: 'DEPOSIT', amount_cents: '100000', balance_after_cents: '100000' },
      { type: 'OWN_TRANSFER_OUT', amount_cents: '-20000', balance_after_cents: '80000' },
      { type: 'OWN_TRANSFER_OUT', amount_cents: '-30000', balance_after_cents: '50000' },
    ]);
    expect(await balance(ana.principalId)).toBe('50000');
    expect(await balance(ana.ahorroId)).toBe('50000');
  });

  it('TRF-21 cada tipo de transferencia usa sus tipos de movimiento', () => {
    expect(movementTypes('THIRD_PARTY')).toEqual({ out: 'TRANSFER_OUT', in: 'TRANSFER_IN' });
    expect(movementTypes('OWN')).toEqual({ out: 'OWN_TRANSFER_OUT', in: 'OWN_TRANSFER_IN' });
    expect(movementTypes('FUNDING')).toEqual({ out: 'TRANSFER_OUT', in: 'DEPOSIT' });
  });
});
