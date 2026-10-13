import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';
import { sqlState } from '../../helpers/pg.js';

const harness = useIntegrationHarness();

beforeEach(async () => {
  // Una transferencia completada con sus dos asientos, escrita por el dueño en una transacción.
  const ana = await insertUserWithAccounts(harness.migrator);
  const runner = harness.migrator.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  const id = randomUUID();
  await runner.query(
    `INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                from_account_id, to_account_id, amount_cents, concept, reference,
                                requires_otp, created_at, completed_at)
     VALUES ($1, $2, $3, repeat('d', 64), 'OWN', 'COMPLETED', $4, $5, 700, 'Ahorro', 1, false,
             now(), now())`,
    [id, ana.userId, randomUUID(), ana.principalId, ana.ahorroId],
  );
  for (const [account, type, amount] of [
    [ana.principalId, 'OWN_TRANSFER_OUT', -700],
    [ana.ahorroId, 'OWN_TRANSFER_IN', 700],
  ] as const) {
    await runner.query(
      `INSERT INTO app.ledger_entries (transfer_id, account_id, type, amount_cents,
                                       balance_after_cents, created_at)
       VALUES ($1, $2, $3, $4, $4, now())`,
      [id, account, type, amount],
    );
  }
  await runner.commitTransaction();
  await runner.release();
});

describe('TRF-23 asientos inmutables', () => {
  it('TRF-23 el rol de la aplicación no puede actualizar, borrar ni truncar asientos (42501)', async () => {
    expect(await sqlState(harness.app.query('UPDATE ledger_entries SET amount_cents = 1'))).toBe(
      '42501',
    );
    expect(await sqlState(harness.app.query('DELETE FROM ledger_entries'))).toBe('42501');
    expect(await sqlState(harness.app.query('TRUNCATE ledger_entries'))).toBe('42501');
  });

  it('TRF-23 el dueño de la tabla no puede borrar ni modificar un asiento por el trigger', async () => {
    await expect(harness.migrator.query('DELETE FROM app.ledger_entries')).rejects.toThrow(
      /solo inserción/,
    );
    await expect(
      harness.migrator.query('UPDATE app.ledger_entries SET balance_after_cents = 0'),
    ).rejects.toThrow(/solo inserción/);
    await expect(harness.migrator.query('TRUNCATE app.ledger_entries CASCADE')).rejects.toThrow(
      /solo inserción/,
    );
  });

  it('TRF-23 la aplicación sí puede leer e insertar asientos', async () => {
    const [{ n }] = await harness.app.query('SELECT count(*)::int AS n FROM ledger_entries');
    expect(n).toBe(2);
    const [{ insert }] = await harness.app.query(
      `SELECT has_table_privilege('app.ledger_entries', 'INSERT') AS insert`,
    );
    expect(insert).toBe(true);
  });
});
