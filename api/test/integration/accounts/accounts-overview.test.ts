import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared/money.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser, type VerifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: VerifiedUser;
let accounts: { principal: string; ahorro: string };

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T23:00:00.000Z' });
  ana = await verifiedUser(t);
  const rows: { id: string; name: string }[] = await harness.migrator.query(
    `SELECT id, name FROM app.accounts WHERE user_id = $1`,
    [ana.userId],
  );
  accounts = {
    principal: rows.find((row) => row.name === 'Principal')?.id ?? '',
    ahorro: rows.find((row) => row.name === 'Ahorro')?.id ?? '',
  };
  await t.container.ledger.fundAccount.execute({
    account: accounts.principal,
    amount: Money.parse('30000.00'),
  });
});

async function overview() {
  const res = await request(t.app)
    .get('/accounts')
    .set('Authorization', `Bearer ${ana.accessToken}`);
  expectToMatchContract(res, 'listAccounts');
  return res.body as {
    accounts: { name: string; balance: string }[];
    dailyLimit: { used: string; remaining: string; resetsAt: string };
  };
}

describe('ACC-13 saldo disponible igual al saldo contable', () => {
  it('ACC-13 una transferencia en PENDING_OTP no cambia el saldo mostrado', async () => {
    await harness.migrator.query(
      `INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                  from_account_id, to_account_id, amount_cents, concept, reference,
                                  requires_otp, otp_expires_at, created_at)
       VALUES ($1, $2, $3, repeat('a', 64), 'OWN', 'PENDING_OTP', $4, $5, 1500000, 'Ahorro', 1,
               true, now() + interval '5 minutes', now())`,
      [randomUUID(), ana.userId, randomUUID(), accounts.principal, accounts.ahorro],
    );
    const body = await overview();
    expect(body.accounts.map((account) => account.balance)).toEqual(['30000.00', '0.00']);
  });
});

describe('ACC-11 límite diario en el resumen', () => {
  it('ACC-11 los movimientos entre cuentas propias y los fondeos no consumen el límite', async () => {
    const body = await overview();
    expect(body.dailyLimit).toMatchObject({ used: '0.00', remaining: '50000.00' });
  });

  it('ACC-11 con el reloj fijo a las 17:00 de CDMX, resetsAt es la medianoche de CDMX en UTC', async () => {
    expect((await overview()).dailyLimit.resetsAt).toBe('2026-10-14T06:00:00.000Z');
    t.clock.set('2026-10-14T06:00:00.000Z');
    // El access token de las 17:00 ya venció: se inicia sesión de nuevo con el reloj adelantado.
    const login = await request(t.app)
      .post('/auth/login')
      .send({ email: ana.person.email, password: ana.person.password });
    ana = { ...ana, accessToken: login.body.tokens.accessToken };
    expect((await overview()).dailyLimit.resetsAt).toBe('2026-10-15T06:00:00.000Z');
  });
});
