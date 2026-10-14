import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { auditEvents } from '../../helpers/audit.js';
import { testDb } from '../../helpers/env.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Ejecuta el script real contra la base de pruebas, con una configuración completa de prueba. */
function dbFund(...args: string[]) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', resolve(root, 'scripts/db-fund.ts'), ...args],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        PATH: process.env.PATH,
        DATABASE_URL: testDb.appUrl,
        JWT_SECRET: Buffer.alloc(32, 1).toString('base64'),
        OTP_HMAC_SECRET: Buffer.alloc(32, 2).toString('base64'),
        CURSOR_SIGNING_SECRET: Buffer.alloc(32, 3).toString('base64'),
        CLABE_BANK_CODE: '999',
        CLABE_PLAZA_CODE: '180',
        SMTP_HOST: 'localhost',
        SMTP_FROM: 'Billetera <no-reply@wallet.local>',
        LOG_LEVEL: 'silent',
      },
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

async function balance(accountId: string): Promise<string> {
  const [row] = await harness.migrator.query(
    'SELECT balance_cents FROM app.accounts WHERE id = $1',
    [accountId],
  );
  return row.balance_cents;
}

describe('ACC-15 script db:fund', () => {
  it('ACC-15 fondea una cuenta por id: +1000.00 en la cuenta, -1000.00 en la Tesorería y FUNDING_POSTED', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const result = dbFund('--account', ana.principalId, '--amount', '1000.00');
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('1000.00');
    expect(await balance(ana.principalId)).toBe('100000');
    expect(await balance(TREASURY_ACCOUNT_ID)).toBe('-100000');
    expect(await auditEvents(harness.migrator)).toMatchObject([
      { action: 'FUNDING_POSTED', actor_type: 'SYSTEM' },
    ]);
  });

  it('ACC-15 fondea una cuenta por CLABE', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(dbFund('--account', ana.ahorroClabe, '--amount', '12.5').status).toBe(0);
    expect(await balance(ana.ahorroId)).toBe('1250');
  });

  it.each(['100.005', '0.00', '-5.00', '1,000'])(
    'ACC-15 con el monto "%s" termina con error y no escribe ningún asiento',
    async (amount) => {
      const ana = await insertUserWithAccounts(harness.migrator);
      const result = dbFund('--account', ana.principalId, '--amount', amount);
      expect(result.status).not.toBe(0);
      expect(result.output).toMatch(/monto/i);
      const [{ n }] = await harness.migrator.query(
        'SELECT count(*)::int AS n FROM app.ledger_entries',
      );
      expect(n).toBe(0);
    },
  );

  it('ACC-15 sin argumentos explica el uso y termina con error', () => {
    const result = dbFund();
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('--account');
  });
});
