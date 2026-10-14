import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { wrongCode } from '../../helpers/identity.js';
import { authed, fund, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

/**
 * Recorrido de contrato del change api-ledger (ACC-10, BEN-01, TRF-03, HIS-03): cada endpoint
 * nuevo con sus respuestas de éxito, de reintento y de error con extensiones. `authed` valida
 * cada respuesta con Ajv contra la operación que corresponde a su método y ruta; aquí además se
 * exige que las extensiones opcionales del Problem estén presentes donde el contrato las promete.
 */
const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

const seen = new Set<string>();
function record(operation: string, res: { status: number }) {
  seen.add(`${operation} ${res.status}`);
  return res;
}

describe('ACC-10 cuentas', () => {
  it('ACC-10 listAccounts 200 y getAccount 200 y 404 cumplen el contrato', async () => {
    const api = authed(t, ana.accessToken);
    expect(record('listAccounts', await api.get('/accounts')).status).toBe(200);
    expect(record('getAccount', await api.get(`/accounts/${ana.principal.id}`)).status).toBe(200);
    expect(record('getAccount', await api.get(`/accounts/${luis.principal.id}`)).status).toBe(404);
  });
});

describe('BEN-01 beneficiarios', () => {
  it('BEN-01 createBeneficiary 201, 200, 409 y 422, y listBeneficiaries 200 cumplen el contrato', async () => {
    const api = authed(t, ana.accessToken);
    const body = { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe };
    expect(record('createBeneficiary', await api.post('/beneficiaries').send(body)).status).toBe(
      201,
    );
    expect(record('createBeneficiary', await api.post('/beneficiaries').send(body)).status).toBe(
      200,
    );
    const conflict = await api.post('/beneficiaries').send({ ...body, alias: 'Otro' });
    expect(record('createBeneficiary', conflict).status).toBe(409);
    const invalid = await api.post('/beneficiaries').send({ ...body, clabe: '123' });
    expect(record('createBeneficiary', invalid).status).toBe(422);
    expect(invalid.body.errors[0]).toMatchObject({ pointer: '/clabe' });
    expect(record('listBeneficiaries', await api.get('/beneficiaries')).status).toBe(200);
  });
});

describe('TRF-03 transferencias', () => {
  it('TRF-03 createTransfer 201, 200 de reintento con Idempotent-Replayed, 400, 404 y 422 con extensiones', async () => {
    const api = authed(t, ana.accessToken);
    const beneficiary = await api
      .post('/beneficiaries')
      .send({ name: 'Luis', alias: 'Luis', clabe: luis.principal.clabe });
    const toLuis = (amount: string, reference = '1') => ({
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: beneficiary.body.id },
      amount,
      concept: 'Pago',
      reference,
    });
    const send = (body: object, key: string | null = randomUUID()) => {
      const req = api.post('/transfers');
      return (key ? req.set('Idempotency-Key', key) : req).send(body);
    };

    // 422 INSUFFICIENT_FUNDS con transferId, y su reintento con el header.
    const key = randomUUID();
    const rejected = await send(toLuis('100.00'), key);
    expect(record('createTransfer', rejected).status).toBe(422);
    expect(rejected.body).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      transferId: expect.any(String),
    });
    const rejectedAgain = await send(toLuis('100.00'), key);
    expect(rejectedAgain.status).toBe(422);
    expect(rejectedAgain.headers['idempotent-replayed']).toBe('true');

    await fund(t, ana.principal.id, '20000.00');
    const createKey = randomUUID();
    const created = await send(toLuis('100.00', '2'), createKey);
    expect(record('createTransfer', created).status).toBe(201);
    const replay = await send(toLuis('100.00', '2'), createKey);
    expect(record('createTransfer', replay).status).toBe(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(created.body.id);

    const reused = await send(toLuis('200.00', '2'), createKey);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(record('createTransfer', await send(toLuis('1.00'), null)).status).toBe(400);
    const foreign = await send({ ...toLuis('1.00'), fromAccountId: luis.principal.id });
    expect(record('createTransfer', foreign).status).toBe(404);

    // 422 DAILY_LIMIT_EXCEEDED con remaining y transferId.
    await harness.migrator.query(
      `UPDATE app.daily_transfer_usage SET used_cents = 4995000 WHERE user_id = $1`,
      [ana.userId],
    );
    const overLimit = await send(toLuis('100.00', '3'));
    expect(overLimit.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      remaining: '50.00',
      transferId: expect.any(String),
    });

    expect(record('getTransfer', await api.get(`/transfers/${created.body.id}`)).status).toBe(200);
    expect(record('getTransfer', await api.get(`/transfers/${randomUUID()}`)).status).toBe(404);
  });

  it('TRF-03 confirmTransfer y resendTransferOtp: 200, 202, 409 y 422 con sus extensiones', async () => {
    const api = authed(t, ana.accessToken);
    await fund(t, ana.principal.id, '40000.00');
    const otp = async (reference: string) => {
      const res = await api
        .post('/transfers')
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: ana.principal.id,
          destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
          amount: '12000.00',
          concept: 'Ahorro',
          reference,
        });
      expect(record('createTransfer', res).status).toBe(201);
      return { id: res.body.id as string, code: t.mailer.lastCode(ana.person.email) };
    };

    const first = await otp('1');
    const resent = await api.post(`/transfers/${first.id}/otp/resend`);
    expect(record('resendTransferOtp', resent).status).toBe(202);
    const code = t.mailer.lastCode(ana.person.email);
    const invalid = await api.post(`/transfers/${first.id}/confirm`).send({ otp: wrongCode(code) });
    expect(record('confirmTransfer', invalid).status).toBe(422);
    expect(invalid.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 2 });
    const confirmed = await api.post(`/transfers/${first.id}/confirm`).send({ otp: code });
    expect(record('confirmTransfer', confirmed).status).toBe(200);
    const notPending = await api.post(`/transfers/${first.id}/otp/resend`);
    expect(record('resendTransferOtp', notPending).status).toBe(409);
    expect(notPending.body).toMatchObject({
      code: 'TRANSFER_NOT_PENDING',
      transferStatus: 'COMPLETED',
    });

    const second = await otp('2');
    for (let i = 0; i < 3; i++) await api.post(`/transfers/${second.id}/otp/resend`);
    const limit = await api.post(`/transfers/${second.id}/otp/resend`);
    expect(record('resendTransferOtp', limit).status).toBe(422);
    expect(limit.body.code).toBe('RESEND_LIMIT_REACHED');
    const lastCode = t.mailer.lastCode(ana.person.email);
    await api.post(`/transfers/${second.id}/confirm`).send({ otp: wrongCode(lastCode) });
    await api.post(`/transfers/${second.id}/confirm`).send({ otp: wrongCode(lastCode) });
    const exhausted = await api
      .post(`/transfers/${second.id}/confirm`)
      .send({ otp: wrongCode(lastCode) });
    expect(exhausted.body).toMatchObject({
      code: 'OTP_ATTEMPTS_EXHAUSTED',
      transferId: second.id,
    });
    const failed = await api.post(`/transfers/${second.id}/confirm`).send({ otp: lastCode });
    expect(record('confirmTransfer', failed).status).toBe(409);
    expect(failed.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: 'FAILED' });

    const third = await otp('3');
    t.clock.advance(6 * 60_000);
    const expired = await api.post(`/transfers/${third.id}/confirm`).send({ otp: '123456' });
    expect(expired.body.code).toBe('TRANSFER_EXPIRED');
    expect(record('getTransfer', await api.get(`/transfers/${third.id}`)).status).toBe(200);
    expect(
      record(
        'confirmTransfer',
        await api.post(`/transfers/${randomUUID()}/confirm`).send({ otp: '123456' }),
      ).status,
    ).toBe(404);
  });
});

describe('HIS-03 historial', () => {
  it('HIS-03 listAccountMovements 200 con página y cursor, 400, 404 y 422 cumplen el contrato', async () => {
    const api = authed(t, ana.accessToken);
    await fund(t, ana.principal.id, '10.00');
    await fund(t, ana.principal.id, '20.00');
    const page = await api.get(`/accounts/${ana.principal.id}/movements?limit=1`);
    expect(record('listAccountMovements', page).status).toBe(200);
    expect(page.body.nextCursor).toEqual(expect.any(String));
    const bad = await api.get(`/accounts/${ana.principal.id}/movements?cursor=abc.def`);
    expect(record('listAccountMovements', bad).status).toBe(400);
    const foreign = await api.get(`/accounts/${luis.principal.id}/movements`);
    expect(record('listAccountMovements', foreign).status).toBe(404);
    const invalid = await api.get(`/accounts/${ana.principal.id}/movements?limit=0`);
    expect(record('listAccountMovements', invalid).status).toBe(422);
  });

  // Depende de que las pruebas anteriores de este archivo corran antes (Vitest las corre en orden).
  it('HIS-03 se recorrieron todos los endpoints nuevos con sus respuestas principales', () => {
    expect([...seen].sort()).toEqual(
      [
        'confirmTransfer 200',
        'confirmTransfer 404',
        'confirmTransfer 409',
        'confirmTransfer 422',
        'createBeneficiary 200',
        'createBeneficiary 201',
        'createBeneficiary 409',
        'createBeneficiary 422',
        'createTransfer 200',
        'createTransfer 201',
        'createTransfer 400',
        'createTransfer 404',
        'createTransfer 422',
        'getAccount 200',
        'getAccount 404',
        'getTransfer 200',
        'getTransfer 404',
        'listAccountMovements 200',
        'listAccountMovements 400',
        'listAccountMovements 404',
        'listAccountMovements 422',
        'listAccounts 200',
        'listBeneficiaries 200',
        'resendTransferOtp 202',
        'resendTransferOtp 409',
        'resendTransferOtp 422',
      ].sort(),
    );
  });
});
