import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OpenDefaultAccounts } from '../../../src/modules/accounts/application/open-default-accounts.js';
import { isValidClabe } from '../../../src/modules/accounts/domain/clabe.js';
import { PgAccountRepository } from '../../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();

async function newUser(): Promise<string> {
  const id = randomUUID();
  await harness.migrator.query(
    `INSERT INTO app.users (id, email, password_hash, full_name, curp, rfc, phone,
                          first_names, paternal_surname, birth_date, birth_state)
     VALUES ($1, $2, 'h', 'Ana', $3, $4, $5, 'Ana', 'Gómez', '1990-01-01', 'DF')`,
    [
      id,
      `${id}@example.com`,
      id.replace(/-/g, '').slice(0, 18).toUpperCase(),
      id.replace(/-/g, '').slice(0, 13).toUpperCase(),
      `+52${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
    ],
  );
  return id;
}

function opener() {
  return new OpenDefaultAccounts({
    accounts: new PgAccountRepository(harness.app),
    clabe: { bankCode: '999', plazaCode: '180' },
    clock: new FakeClock('2026-10-13T18:00:00Z'),
  });
}

describe('ACC-04 apertura de cuentas', () => {
  it('ACC-04 abre "Principal" y "Ahorro" con saldo 0 y CLABE válida del banco configurado', async () => {
    const userId = await newUser();
    const runner = new TypeormTransactionRunner(harness.app);
    const opened = await runner.run((tx) => opener().execute(tx, userId));
    expect(opened.map((account) => account.name)).toEqual(['Principal', 'Ahorro']);

    const rows = await harness.migrator.query(
      `SELECT name, type, clabe, balance_cents FROM app.accounts WHERE user_id = $1 ORDER BY created_at, name DESC`,
      [userId],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ type: 'USER', balance_cents: '0' });
      expect(row.clabe).toMatch(/^999180[0-9]{12}$/);
      expect(isValidClabe(row.clabe)).toBe(true);
    }
    expect(rows[0].clabe).not.toBe(rows[1].clabe);
  });

  it('ACC-04 es un paso transaccional: si la transacción se revierte, no quedan cuentas', async () => {
    const userId = await newUser();
    const runner = new TypeormTransactionRunner(harness.app);
    await expect(
      runner.run(async (tx) => {
        await opener().execute(tx, userId);
        throw new Error('la verificación falló después de abrir cuentas');
      }),
    ).rejects.toThrow();
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.accounts WHERE user_id = $1',
      [userId],
    );
    expect(n).toBe(0);
  });

  it('ACC-04 repetir la apertura no crea cuentas adicionales', async () => {
    const userId = await newUser();
    const runner = new TypeormTransactionRunner(harness.app);
    await runner.run((tx) => opener().execute(tx, userId));
    await expect(runner.run((tx) => opener().execute(tx, userId))).rejects.toMatchObject({
      driverError: { constraint: 'uq_accounts_user_name' },
    });
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.accounts WHERE user_id = $1',
      [userId],
    );
    expect(n).toBe(2);
  });
});
