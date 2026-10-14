import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { wrongCode } from '../../helpers/identity.js';
import {
  addBeneficiary,
  balanceOf,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
});

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
});
const toAhorro = (amount: string) => ({
  ...toLuis(amount),
  destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
});

async function pending(body: Record<string, unknown> = toLuis('15000.00')) {
  const res = await postTransfer(t, ana, body);
  expect(res.body.status).toBe('PENDING_OTP');
  return { id: res.body.id as string, code: t.mailer.lastCode(ana.person.email) };
}

async function stored(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT t.status, t.failure_reason, c.attempts,
            (SELECT count(*)::int FROM app.ledger_entries e WHERE e.transfer_id = t.id) AS entries
       FROM app.transfers t LEFT JOIN app.one_time_codes c ON c.subject_id = t.id
      WHERE t.id = $1`,
    [id],
  );
  return row;
}

/** Retiene la fila contador del día para que las peticiones lleguen juntas al bloqueo. */
async function holdingCounter<T>(run: () => Promise<T>, waiting: number): Promise<T> {
  const holder = harness.migrator.createQueryRunner();
  await holder.connect();
  try {
    await holder.startTransaction();
    await holder.query(`SELECT 1 FROM app.daily_transfer_usage WHERE user_id = $1 FOR UPDATE`, [
      ana.userId,
    ]);
    const result = run();
    for (let i = 0; i < 150; i++) {
      const [{ n }] = await harness.migrator.query(
        'SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted',
      );
      if (n >= waiting) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await holder.commitTransaction();
    return await result;
  } finally {
    if (holder.isTransactionActive) await holder.rollbackTransaction();
    await holder.release();
  }
}

describe('TRF-16 confirmación', () => {
  it('TRF-16 con el código correcto antes de que venza responde 200 COMPLETED y mueve los saldos', async () => {
    const { id, code } = await pending();
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: 'COMPLETED', requiresOtp: true, otp: null });
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('15000.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-16 si el saldo se gastó en otra operación mientras esperaba, 422 INSUFFICIENT_FUNDS y FAILED', async () => {
    const { id, code } = await pending();
    expect((await postTransfer(t, ana, toAhorro('8000.00'))).body.status).toBe('COMPLETED');
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', transferId: id });
    expect(await stored(id)).toMatchObject({
      status: 'FAILED',
      failure_reason: 'INSUFFICIENT_FUNDS',
      entries: 0,
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('12000.00');
  });
});

describe('TRF-17 intentos', () => {
  it('TRF-17 cada código incorrecto descuenta un intento y el tercero responde OTP_ATTEMPTS_EXHAUSTED', async () => {
    const { id, code } = await pending();
    const first = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(first.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 2 });
    const second = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(second.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 1 });
    const third = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(third.status).toBe(422);
    expect(third.body).toMatchObject({ code: 'OTP_ATTEMPTS_EXHAUSTED', transferId: id });
    expect(await stored(id)).toMatchObject({
      status: 'FAILED',
      failure_reason: 'OTP_ATTEMPTS_EXHAUSTED',
      attempts: 3,
    });
  });
});

describe('TRF-18 confirmación idempotente por estado', () => {
  it('TRF-18 dos confirmaciones simultáneas a un tercero: ambas 200 COMPLETED y exactamente dos asientos', async () => {
    const { id, code } = await pending();
    const [a, b] = await holdingCounter(
      () =>
        Promise.all([
          confirmTransfer(t, ana, id, { otp: code }),
          confirmTransfer(t, ana, id, { otp: code }),
        ]),
      2,
    );
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.status, b.body.status]).toEqual(['COMPLETED', 'COMPLETED']);
    expect(await stored(id)).toMatchObject({ status: 'COMPLETED', entries: 2, attempts: 0 });
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-18 cuatro confirmaciones simultáneas entre cuentas propias se ordenan por la fila de la transferencia', async () => {
    const { id, code } = await pending(toAhorro('12000.00'));
    const results = await Promise.all(
      Array.from({ length: 4 }, () => confirmTransfer(t, ana, id, { otp: code })),
    );
    expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200]);
    expect(await stored(id)).toMatchObject({ status: 'COMPLETED', entries: 2 });
    expect(await balanceOf(harness, ana.ahorro.id)).toBe('12000.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-18 si la respuesta se perdió, el reintento responde 200 COMPLETED sin consumir intentos', async () => {
    const { id, code } = await pending();
    await confirmTransfer(t, ana, id, { otp: code }); // la app no recibió esta respuesta
    t.clock.advance(10_000);
    const retry = await confirmTransfer(t, ana, id, { otp: code });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ id, status: 'COMPLETED' });
    expect(await stored(id)).toMatchObject({ attempts: 0, entries: 2 });
  });

  it.each(['FAILED', 'REJECTED'] as const)(
    'TRF-18 confirmar una transferencia %s responde 409 TRANSFER_NOT_PENDING con transferStatus',
    async (status) => {
      let id: string;
      if (status === 'FAILED') {
        const created = await pending();
        id = created.id;
        for (let i = 0; i < 3; i++) {
          await confirmTransfer(t, ana, id, { otp: wrongCode(created.code) });
        }
      } else {
        const rejected = await postTransfer(t, ana, toLuis('25000.00'));
        expect(rejected.body.code).toBe('INSUFFICIENT_FUNDS');
        id = rejected.body.transferId;
      }
      const res = await confirmTransfer(t, ana, id, { otp: '123456' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: status });
    },
  );
});
