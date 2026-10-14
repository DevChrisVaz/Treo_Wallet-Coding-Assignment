import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
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

async function setup(now = '2026-10-13T18:00:00.000Z') {
  t = await buildTestApp(harness, { now });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
}

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
});

/** Transferencia de 15,000.00 a Luis en PENDING_OTP y el código que llegó por correo. */
async function pending(amount = '15000.00') {
  const res = await postTransfer(t, ana, toLuis(amount));
  expect(res.body.status).toBe('PENDING_OTP');
  return { id: res.body.id as string, code: t.mailer.lastCode(ana.person.email) };
}

async function transferRow(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT status, failure_reason, completed_at FROM app.transfers WHERE id = $1`,
    [id],
  );
  return row;
}

async function codeRow(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT attempts, consumed_at FROM app.one_time_codes WHERE subject_id = $1`,
    [id],
  );
  return row;
}

async function actionsFor(id: string) {
  return (await auditEvents(harness.migrator))
    .filter((event) => event.entity_id === id)
    .map((event) => ({ action: event.action, metadata: event.metadata }));
}

async function usedToday(): Promise<string | undefined> {
  const [row] = await harness.migrator.query(
    `SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1 AND day = '2026-10-13'`,
    [ana.userId],
  );
  return row?.used_cents;
}

describe('TRF-16 confirmación con el código correcto', () => {
  beforeEach(async () => {
    await setup();
  });

  it('TRF-16 completa la transferencia: asientos, saldos, límite, código consumido y TRANSFER_COMPLETED', async () => {
    const { id, code } = await pending();
    t.clock.advance(60_000);
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'COMPLETED',
      otp: null,
      completedAt: '2026-10-13T18:01:00.000Z',
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('15000.00');
    expect(await usedToday()).toBe('1500000');
    expect((await codeRow(id)).consumed_at).toEqual(new Date('2026-10-13T18:01:00.000Z'));
    expect((await actionsFor(id)).map((event) => event.action)).toEqual([
      'TRANSFER_CREATED',
      'TRANSFER_OTP_SENT',
      'TRANSFER_COMPLETED',
    ]);
    expect((await actionsFor(id)).at(2)?.metadata).toEqual({
      kind: 'THIRD_PARTY',
      amount: '15000.00',
    });
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-18 confirmar una transferencia ya COMPLETED responde 200 sin consumir intentos', async () => {
    const { id, code } = await pending();
    await confirmTransfer(t, ana, id, { otp: code });
    const again = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('COMPLETED');
    expect((await codeRow(id)).attempts).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
  });
});

describe('TRF-17 código incorrecto', () => {
  beforeEach(async () => {
    await setup();
  });

  it('TRF-17 el primer código incorrecto es 422 OTP_INVALID con attemptsRemaining 2 y el intento queda registrado', async () => {
    const { id, code } = await pending();
    const res = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 2 });
    expect((await codeRow(id)).attempts).toBe(1);
    expect((await transferRow(id)).status).toBe('PENDING_OTP');
    expect((await actionsFor(id)).at(-1)).toEqual({
      action: 'OTP_ATTEMPT_FAILED',
      metadata: { purpose: 'TRANSFER_CONFIRMATION', attemptsRemaining: 2 },
    });
  });

  it('TRF-17 el tercer código incorrecto deja la transferencia FAILED y el código correcto ya no sirve', async () => {
    const { id, code } = await pending();
    await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    const third = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(third.status).toBe(422);
    expect(third.body).toMatchObject({ code: 'OTP_ATTEMPTS_EXHAUSTED', transferId: id });
    expect(await transferRow(id)).toEqual({
      status: 'FAILED',
      failure_reason: 'OTP_ATTEMPTS_EXHAUSTED',
      completed_at: null,
    });
    expect((await actionsFor(id)).slice(-2)).toEqual([
      {
        action: 'OTP_ATTEMPTS_EXHAUSTED',
        metadata: { purpose: 'TRANSFER_CONFIRMATION', attemptsRemaining: 0 },
      },
      {
        action: 'TRANSFER_FAILED',
        metadata: { reason: 'OTP_ATTEMPTS_EXHAUSTED', amount: '15000.00' },
      },
    ]);
    const late = await confirmTransfer(t, ana, id, { otp: code });
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: 'FAILED' });
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
  });
});

describe('TRF-16 revalidación bajo bloqueo al confirmar', () => {
  beforeEach(async () => {
    await setup();
  });

  it('TRF-16 si el saldo se gastó mientras esperaba, responde 422 INSUFFICIENT_FUNDS y queda FAILED sin asientos', async () => {
    const { id, code } = await pending();
    const spent = await postTransfer(t, ana, {
      ...toLuis('10000.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
    });
    expect(spent.body.status).toBe('COMPLETED');
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', transferId: id });
    expect(await transferRow(id)).toEqual({
      status: 'FAILED',
      failure_reason: 'INSUFFICIENT_FUNDS',
      completed_at: null,
    });
    const entries = await harness.migrator.query(
      'SELECT 1 FROM app.ledger_entries WHERE transfer_id = $1',
      [id],
    );
    expect(entries).toEqual([]);
    expect((await actionsFor(id)).at(-1)).toEqual({
      action: 'TRANSFER_FAILED',
      metadata: { reason: 'INSUFFICIENT_FUNDS', amount: '15000.00' },
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('10000.00');
  });

  it('TRF-16 si el límite se consumió mientras esperaba, responde 422 DAILY_LIMIT_EXCEEDED con remaining y queda FAILED', async () => {
    const { id, code } = await pending();
    await harness.migrator.query(
      `UPDATE app.daily_transfer_usage SET used_cents = 4000000
        WHERE user_id = $1 AND day = '2026-10-13'`,
      [ana.userId],
    );
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      transferId: id,
      remaining: '10000.00',
    });
    expect((await transferRow(id)).failure_reason).toBe('DAILY_LIMIT_EXCEEDED');
    expect(await usedToday()).toBe('4000000');
  });
});

describe('TRF-19 y TRF-06 transferencias que no se pueden confirmar', () => {
  beforeEach(async () => {
    await setup();
  });

  it('TRF-19 a los 6 minutos responde 409 TRANSFER_EXPIRED sin mover dinero', async () => {
    const { id, code } = await pending();
    t.clock.advance(6 * 60_000);
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_EXPIRED');
    expect((await transferRow(id)).status).toBe('PENDING_OTP');
    expect((await codeRow(id)).attempts).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
  });

  it('TRF-06 Luis no puede confirmar la transferencia de Ana: 404', async () => {
    const { id, code } = await pending();
    const res = await confirmTransfer(t, luis, id, { otp: code });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect((await transferRow(id)).status).toBe('PENDING_OTP');
  });

  it('TRF-06 un id que no es UUID o que no existe responde 404', async () => {
    expect((await confirmTransfer(t, ana, 'no-es-uuid', { otp: '123456' })).status).toBe(404);
    expect((await confirmTransfer(t, ana, randomUUID(), { otp: '123456' })).status).toBe(404);
  });

  it.each([
    ['un código de 5 dígitos', { otp: '12345' }],
    ['un número JSON', { otp: 123456 }],
    ['sin código', {}],
  ])('TRF-16 %s es 422 VALIDATION_FAILED en /otp', async (_case, body) => {
    const { id } = await pending();
    const res = await confirmTransfer(t, ana, id, body);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors[0].pointer).toBe('/otp');
    expect((await codeRow(id)).attempts).toBe(0);
  });
});

describe('TRF-12 la confirmación usa el día de CDMX tomado después de los bloqueos', () => {
  it('TRF-12 si la medianoche llega mientras espera la fila contador, reintenta y consume el día nuevo', async () => {
    await setup('2026-10-14T05:58:00.000Z'); // 23:58 en CDMX: el OTP vence a las 00:03
    const { id, code } = await pending();
    const holder = harness.migrator.createQueryRunner();
    await holder.connect();
    try {
      await holder.startTransaction();
      await holder.query(
        `SELECT 1 FROM app.daily_transfer_usage
          WHERE user_id = $1 AND day = '2026-10-13' FOR UPDATE`,
        [ana.userId],
      );
      t.clock.set('2026-10-14T05:59:59.500Z');
      const confirming = confirmTransfer(t, ana, id, { otp: code });
      for (let i = 0; i < 100; i++) {
        const [{ n }] = await harness.migrator.query(
          'SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted',
        );
        if (n > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      t.clock.set('2026-10-14T06:00:00.500Z');
      await holder.commitTransaction();
      const res = await confirming;
      expect(res.status).toBe(200);
      expect(res.body.completedAt).toBe('2026-10-14T06:00:00.500Z');
      const usage = await harness.migrator.query(
        `SELECT day::text AS day, used_cents FROM app.daily_transfer_usage
          WHERE user_id = $1 ORDER BY day`,
        [ana.userId],
      );
      expect(usage).toEqual([
        { day: '2026-10-13', used_cents: '0' },
        { day: '2026-10-14', used_cents: '1500000' },
      ]);
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }
  });
});
