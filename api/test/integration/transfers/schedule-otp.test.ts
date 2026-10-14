import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { wrongCode } from '../../helpers/identity.js';
import {
  addBeneficiary,
  authed,
  balanceOf,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  resendTransferOtp,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

/** 14 de octubre de 2026, 12:00 en la Ciudad de México, salvo que la prueba diga otra hora. */
async function setup(now = '2026-10-14T18:00:00.000Z') {
  t = await buildTestApp(harness, { now });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
}

const toLuis = (amount: string, scheduledFor: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
  scheduledFor,
});

/** Programada de 15,000.00 a Luis en PENDING_OTP y el código que llegó por correo. */
async function pendingScheduled(scheduledFor = '2026-10-20T15:00:00.000Z') {
  const res = await postTransfer(t, ana, toLuis('15000.00', scheduledFor));
  expect(res.status).toBe(201);
  return { id: res.body.id as string, code: t.mailer.lastCode(ana.person.email), res };
}

async function codeRow(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT attempts, consumed_at FROM app.one_time_codes WHERE subject_id = $1`,
    [id],
  );
  return row;
}

async function transferRow(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT status, failure_reason, scheduled_for, completed_at
       FROM app.transfers WHERE id = $1`,
    [id],
  );
  return row;
}

async function actionsFor(id: string) {
  return (await auditEvents(harness.migrator))
    .filter((event) => event.entity_id === id)
    .map((event) => ({ action: event.action, actor: event.actor_type, metadata: event.metadata }));
}

async function countOf(table: 'ledger_entries' | 'daily_transfer_usage'): Promise<number> {
  const [{ n }] = await harness.migrator.query(`SELECT count(*)::int AS n FROM app.${table}`);
  return n;
}

describe('TRF-28 programación con OTP', () => {
  beforeEach(async () => {
    await setup();
    await fund(t, ana.principal.id, '20000.00');
  });

  it('TRF-28 15000.00 programada para el 20 queda PENDING_OTP con scheduledFor y desafío, sin tocar saldo', async () => {
    const { id, res } = await pendingScheduled();
    expect(res.body).toMatchObject({
      id,
      status: 'PENDING_OTP',
      scheduledFor: '2026-10-20T15:00:00.000Z',
      requiresOtp: true,
      completedAt: null,
      cancelledAt: null,
      otp: {
        channel: 'EMAIL',
        deliveryStatus: 'SENT',
        expiresAt: '2026-10-14T18:05:00.000Z',
        attemptsRemaining: 3,
        resendsRemaining: 3,
      },
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
    expect(await countOf('daily_transfer_usage')).toBe(0);
    expect(await actionsFor(id)).toEqual([
      {
        action: 'TRANSFER_CREATED',
        actor: 'USER',
        metadata: {
          status: 'PENDING_OTP',
          kind: 'THIRD_PARTY',
          amount: '15000.00',
          scheduledFor: '2026-10-20T15:00:00.000Z',
        },
      },
      {
        action: 'TRANSFER_OTP_SENT',
        actor: 'USER',
        metadata: { channel: 'EMAIL', expiresAt: '2026-10-14T18:05:00.000Z' },
      },
    ]);
  });

  it('TRF-28 el correo con el código menciona el 20 de octubre de 2026, 09:00 (CDMX)', async () => {
    await pendingScheduled();
    const message = t.mailer.to(ana.person.email).at(-1);
    expect(message?.subject).toBe('Tu código para confirmar una transferencia');
    for (const body of [message?.text, message?.html]) {
      expect(body).toContain('Programada para el 20 de octubre de 2026, 09:00');
      expect(body).toContain('$15,000.00');
      expect(body).toContain(luis.principal.clabe.slice(-4));
    }
  });

  it('TRF-28 el reenvío del código también menciona la fecha programada', async () => {
    const { id } = await pendingScheduled();
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(202);
    expect(t.mailer.to(ana.person.email).at(-1)?.text).toContain(
      'Programada para el 20 de octubre de 2026, 09:00',
    );
  });

  it('TRF-28 confirmar con el código correcto la deja SCHEDULED sin mover dinero ni tocar el límite', async () => {
    const { id, code } = await pendingScheduled();
    const entriesBefore = await countOf('ledger_entries');
    t.clock.advance(60_000);
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'SCHEDULED',
      scheduledFor: '2026-10-20T15:00:00.000Z',
      otp: null,
      completedAt: null,
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
    expect(await countOf('ledger_entries')).toBe(entriesBefore);
    expect(await countOf('daily_transfer_usage')).toBe(0);
    expect((await codeRow(id)).consumed_at).toEqual(new Date('2026-10-14T18:01:00.000Z'));
    expect((await actionsFor(id)).at(-1)).toEqual({
      action: 'TRANSFER_SCHEDULED',
      actor: 'USER',
      metadata: {
        kind: 'THIRD_PARTY',
        amount: '15000.00',
        scheduledFor: '2026-10-20T15:00:00.000Z',
      },
    });
  });

  it('TRF-28 la confirmación no revalida saldo: sin fondos hoy, la programada queda SCHEDULED', async () => {
    const { id, code } = await pendingScheduled();
    await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
      amount: '10000.00',
      concept: 'Vaciar',
      reference: '1',
    });
    await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
      amount: '10000.00',
      concept: 'Vaciar',
      reference: '2',
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('0.00');
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('TRF-28 doble confirmación: la segunda responde 200 SCHEDULED sin consumir intentos', async () => {
    const { id, code } = await pendingScheduled();
    await confirmTransfer(t, ana, id, { otp: code });
    const again = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('SCHEDULED');
    expect((await codeRow(id)).attempts).toBe(0);
    expect(
      (await actionsFor(id)).filter((event) => event.action === 'TRANSFER_SCHEDULED'),
    ).toHaveLength(1);
  });

  it('TRF-28 confirmar una programada cancelada responde 409 TRANSFER_NOT_PENDING con su estado', async () => {
    const { id, code } = await pendingScheduled();
    await confirmTransfer(t, ana, id, { otp: code });
    const cancelled = await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`);
    expect(cancelled.status).toBe(200);
    const res = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: 'CANCELLED' });
    expect((await codeRow(id)).attempts).toBe(0);
    expect(await transferRow(id)).toMatchObject({ status: 'CANCELLED' });
  });

  it('TRF-32 confirmar una programada que ya se ejecutó responde 200 COMPLETED sin consumir intentos', async () => {
    const { id, code } = await pendingScheduled('2026-10-15T06:00:00.000Z');
    await confirmTransfer(t, ana, id, { otp: code });
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    const res = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'COMPLETED',
      scheduledFor: '2026-10-15T06:00:00.000Z',
    });
    expect((await codeRow(id)).attempts).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
  });

  it('TRF-28 un código incorrecto responde OTP_INVALID y el tercero la deja FAILED: nunca se programa', async () => {
    const { id, code } = await pendingScheduled();
    const first = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(first.status).toBe(422);
    expect(first.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 2 });
    await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    const third = await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    expect(third.status).toBe(422);
    expect(third.body).toMatchObject({ code: 'OTP_ATTEMPTS_EXHAUSTED', transferId: id });
    expect(await transferRow(id)).toMatchObject({
      status: 'FAILED',
      failure_reason: 'OTP_ATTEMPTS_EXHAUSTED',
      scheduled_for: new Date('2026-10-20T15:00:00.000Z'),
    });
    const late = await confirmTransfer(t, ana, id, { otp: code });
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: 'FAILED' });
  });

  it('TRF-28 sin confirmar en 5 minutos queda EXPIRED y confirmarla después es 409 TRANSFER_EXPIRED', async () => {
    const { id, code } = await pendingScheduled();
    t.clock.advance(5 * 60_000);
    const shown = await authed(t, ana.accessToken).get(`/transfers/${id}`);
    expect(shown.status).toBe(200);
    expect(shown.body).toMatchObject({
      status: 'EXPIRED',
      scheduledFor: '2026-10-20T15:00:00.000Z',
      otp: null,
    });
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_EXPIRED');
    expect(await transferRow(id)).toMatchObject({ status: 'PENDING_OTP' });
  });

  it('TRF-28 confirmar una programada no hace fila detrás del contador del límite del usuario', async () => {
    const { id, code } = await pendingScheduled();
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-14', 0, 5000000)`,
      [ana.userId],
    );
    const holder = harness.migrator.createQueryRunner();
    await holder.connect();
    try {
      await holder.startTransaction();
      await holder.query(`SELECT 1 FROM app.daily_transfer_usage WHERE user_id = $1 FOR UPDATE`, [
        ana.userId,
      ]);
      const confirmed = await Promise.race([
        confirmTransfer(t, ana, id, { otp: code }),
        new Promise<'bloqueada'>((resolve) => setTimeout(() => resolve('bloqueada'), 2_000)),
      ]);
      expect(confirmed).not.toBe('bloqueada');
      if (confirmed !== 'bloqueada') expect(confirmed.body.status).toBe('SCHEDULED');
    } finally {
      await holder.rollbackTransaction();
      await holder.release();
    }
  });
});

describe('TRF-28 confirmación después de medianoche', () => {
  it('TRF-28 creada a las 23:58 del 14 para el 15 y confirmada a las 00:02 del 15 queda SCHEDULED', async () => {
    await setup('2026-10-15T05:58:00.000Z'); // 23:58 del 14 en CDMX
    const { id, code } = await pendingScheduled('2026-10-15T06:10:00.000Z');
    t.clock.set('2026-10-15T06:02:00.000Z'); // 00:02 del 15: ya pasó la medianoche de la creación
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      scheduledFor: '2026-10-15T06:10:00.000Z',
    });
  });

  it('TRF-28 una programada por encima del umbral no valida saldo ni límite al crearse', async () => {
    await setup();
    const res = await postTransfer(
      t,
      ana,
      toLuis('15000.00', '2026-10-15T06:00:00.000Z'),
      randomUUID(),
    );
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_OTP');
    expect(await balanceOf(harness, ana.principal.id)).toBe('0.00');
  });
});
