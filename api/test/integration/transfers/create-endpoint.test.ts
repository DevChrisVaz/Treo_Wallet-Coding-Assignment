import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, fund, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  await fund(t, ana.principal.id, '1000.00');
});

const body = () => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
  amount: '100.00',
  concept: 'Ahorro',
  reference: '1',
});

describe('TRF-01 POST /transfers', () => {
  it('TRF-01 responde 201 con la transferencia completada, conforme al contrato', async () => {
    const res = await authed(t, ana.accessToken)
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(body());
    expectToMatchContract(res, 'createTransfer');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', kind: 'OWN', amount: '100.00' });
    expect(res.headers['idempotent-replayed']).toBeUndefined();
  });

  it('TRF-03 el reintento responde 200 con Idempotent-Replayed: true', async () => {
    const key = randomUUID();
    const first = await authed(t, ana.accessToken)
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(body());
    const again = await authed(t, ana.accessToken)
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send(body());
    expectToMatchContract(again, 'createTransfer');
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body.id).toBe(first.body.id);
  });

  it('TRF-02 sin Idempotency-Key responde 400 IDEMPOTENCY_KEY_MISSING', async () => {
    const res = await authed(t, ana.accessToken).post('/transfers').send(body());
    expectToMatchContract(res, 'createTransfer');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_MISSING');
  });

  it('TRF-10 un rechazo responde 422 con transferId conforme al contrato', async () => {
    const res = await authed(t, ana.accessToken)
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send({ ...body(), amount: '5000.00' });
    expectToMatchContract(res, 'createTransfer');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', transferId: expect.any(String) });
  });

  it('TRF-06 sin token responde 401', async () => {
    const res = await authed(t, 'token-invalido')
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(body());
    expectToMatchContract(res, 'createTransfer');
    expect(res.status).toBe(401);
  });
});
