import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared/money.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function listAccounts(token?: string) {
  const req = request(t.app).get('/accounts');
  const res = token ? await req.set('Authorization', `Bearer ${token}`) : await req;
  expectToMatchContract(res, 'listAccounts');
  return res;
}

describe('ACC-10 consulta de cuentas con saldo disponible', () => {
  it('ACC-10 devuelve exactamente sus dos cuentas con saldo en 2 decimales y MXN', async () => {
    const ana = await verifiedUser(t);
    const [principal] = await harness.migrator.query(
      `SELECT id FROM app.accounts WHERE user_id = $1 AND name = 'Principal'`,
      [ana.userId],
    );
    await t.container.ledger.fundAccount.execute({
      account: principal.id,
      amount: Money.parse('25000'),
    });
    const res = await listAccounts(ana.accessToken);
    expect(res.status).toBe(200);
    expect(
      res.body.accounts.map((a: { name: string; balance: string; currency: string }) => [
        a.name,
        a.balance,
        a.currency,
      ]),
    ).toEqual([
      ['Principal', '25000.00', 'MXN'],
      ['Ahorro', '0.00', 'MXN'],
    ]);
    expect(res.body.accounts[0].clabe).toMatch(/^999180[0-9]{12}$/);
  });

  it('ACC-10 no incluye cuentas de otros usuarios ni la Tesorería', async () => {
    const ana = await verifiedUser(t);
    await verifiedUser(t);
    const res = await listAccounts(ana.accessToken);
    expect(res.body.accounts).toHaveLength(2);
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.accounts WHERE id = ANY($1) AND user_id = $2`,
      [res.body.accounts.map((a: { id: string }) => a.id), ana.userId],
    );
    expect(n).toBe(2);
  });

  it('ACC-10 sin access token responde 401 UNAUTHENTICATED', async () => {
    const res = await listAccounts();
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
