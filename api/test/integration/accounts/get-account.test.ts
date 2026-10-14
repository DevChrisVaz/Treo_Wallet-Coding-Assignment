import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser, type VerifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: VerifiedUser;
let luis: VerifiedUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await verifiedUser(t);
  luis = await verifiedUser(t);
});

async function accountsOf(userId: string): Promise<{ id: string; name: string }[]> {
  return harness.migrator.query(
    `SELECT id, name FROM app.accounts WHERE user_id = $1 ORDER BY name DESC`,
    [userId],
  );
}

async function getAccount(id: string, token = ana.accessToken) {
  const res = await request(t.app).get(`/accounts/${id}`).set('Authorization', `Bearer ${token}`);
  expectToMatchContract(res, 'getAccount');
  return res;
}

/** El cuerpo sin lo que depende de la petición (su id y su ruta). */
function comparable(body: Record<string, unknown>) {
  const { requestId: _requestId, instance: _instance, ...rest } = body;
  return rest;
}

describe('ACC-12 detalle de una cuenta propia', () => {
  it('ACC-12 devuelve id, nombre, CLABE, saldo y moneda de la cuenta propia', async () => {
    const [principal] = await accountsOf(ana.userId);
    const res = await getAccount(principal?.id ?? '');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: principal?.id,
      name: 'Principal',
      balance: '0.00',
      currency: 'MXN',
    });
    expect(res.body.clabe).toMatch(/^[0-9]{18}$/);
  });

  it('ACC-12 una cuenta ajena, una inexistente y la Tesorería responden el mismo 404', async () => {
    const [luisAccount] = await accountsOf(luis.userId);
    const responses = await Promise.all([
      getAccount(luisAccount?.id ?? ''),
      getAccount(randomUUID()),
      getAccount(TREASURY_ACCOUNT_ID),
      getAccount('no-es-un-uuid'),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
    const bodies = responses.map((res) => comparable(res.body));
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  });

  it('ACC-12 sin token responde 401', async () => {
    const res = await request(t.app).get(`/accounts/${randomUUID()}`);
    expectToMatchContract(res, 'getAccount');
    expect(res.status).toBe(401);
  });
});
