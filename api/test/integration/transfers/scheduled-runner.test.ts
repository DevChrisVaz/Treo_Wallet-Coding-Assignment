import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  balanceOf,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

/** 14 de octubre de 2026, 12:00 en la Ciudad de México. */
const OCT_14_NOON = '2026-10-14T18:00:00.000Z';
/** 00:00:30 del 15 de octubre en la Ciudad de México. */
const OCT_15_JUST_AFTER_MIDNIGHT = '2026-10-15T06:00:30.000Z';

async function setup(now = OCT_14_NOON) {
  t = await buildTestApp(harness, { now });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
}

beforeEach(async () => {
  await setup();
});

const toLuis = (amount: string, scheduledFor: string, reference = '1') => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta',
  reference,
  scheduledFor,
});

async function schedule(
  amount: string,
  scheduledFor = '2026-10-15T06:00:00.000Z',
  reference = '1',
) {
  const res = await postTransfer(t, ana, toLuis(amount, scheduledFor, reference));
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function transferRow(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT status, failure_reason, completed_at FROM app.transfers WHERE id = $1`,
    [id],
  );
  return row as { status: string; failure_reason: string | null; completed_at: Date | null };
}

async function entriesOf(id: string) {
  return harness.migrator.query(
    `SELECT type, amount_cents, created_at FROM app.ledger_entries
      WHERE transfer_id = $1 ORDER BY amount_cents`,
    [id],
  );
}

async function usage(day: string): Promise<string | undefined> {
  const [row] = await harness.migrator.query(
    `SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1 AND day = $2::date`,
    [ana.userId, day],
  );
  return row?.used_cents;
}

async function setUsage(day: string, usedCents: number) {
  await harness.migrator.query(
    `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
     VALUES ($1, $2::date, $3, 5000000)`,
    [ana.userId, day, usedCents],
  );
}

async function executionEvents(id: string) {
  return (await auditEvents(harness.migrator)).filter(
    (event) =>
      event.entity_id === id &&
      (event.action === 'TRANSFER_COMPLETED' || event.action === 'TRANSFER_FAILED'),
  );
}

const runOnce = () => t.container.scheduler.runner.runOnce();

describe('TRF-30 ejecución en la fecha programada', () => {
  it('TRF-30 a las 00:00:30 del 15 se completa la programada del 15: dos asientos, saldos y límite del 15', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    expect(await transferRow(id)).toEqual({
      status: 'COMPLETED',
      failure_reason: null,
      completed_at: new Date(OCT_15_JUST_AFTER_MIDNIGHT),
    });
    expect(await entriesOf(id)).toEqual([
      {
        type: 'TRANSFER_OUT',
        amount_cents: '-100000',
        created_at: new Date(OCT_15_JUST_AFTER_MIDNIGHT),
      },
      {
        type: 'TRANSFER_IN',
        amount_cents: '100000',
        created_at: new Date(OCT_15_JUST_AFTER_MIDNIGHT),
      },
    ]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('4000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('1000.00');
    expect(await usage('2026-10-15')).toBe('100000');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-30 el historial de Ana muestra el TRANSFER_OUT del 15 de octubre', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);
    await runOnce();

    const session = await signInAgain(t, ana);
    const res = await authed(t, session.accessToken).get(
      `/accounts/${ana.principal.id}/movements?from=2026-10-15&to=2026-10-15`,
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        type: 'TRANSFER_OUT',
        amount: '-1000.00',
        transferId: id,
        occurredAt: OCT_15_JUST_AFTER_MIDNIGHT,
      }),
    ]);
  });

  it('TRF-30 a las 23:59 del 14 la programada del 15 sigue en SCHEDULED', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set('2026-10-15T05:59:00.000Z');

    await runOnce();

    expect((await transferRow(id)).status).toBe('SCHEDULED');
    expect(await entriesOf(id)).toEqual([]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
  });

  it('TRF-30 sin saldo al ejecutarse queda FAILED con INSUFFICIENT_FUNDS, sin asientos y con el saldo intacto', async () => {
    await fund(t, ana.principal.id, '500.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    expect(await transferRow(id)).toEqual({
      status: 'FAILED',
      failure_reason: 'INSUFFICIENT_FUNDS',
      completed_at: null,
    });
    expect(await entriesOf(id)).toEqual([]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('500.00');
    expect(await usage('2026-10-15')).toBe('0');
  });

  it('TRF-30 con 45000.00 ya transferidos el día de ejecución, una de 6000.00 queda FAILED con DAILY_LIMIT_EXCEEDED', async () => {
    await fund(t, ana.principal.id, '10000.00');
    const id = await schedule('6000.00');
    await setUsage('2026-10-15', 4_500_000);
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    expect(await transferRow(id)).toMatchObject({
      status: 'FAILED',
      failure_reason: 'DAILY_LIMIT_EXCEEDED',
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('10000.00');
    expect(await usage('2026-10-15')).toBe('4500000');
  });

  it('TRF-30 límite que cruza medianoche: con el del 14 agotado, la del 15 se completa y consume el del 15', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    await setUsage('2026-10-14', 5_000_000);
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    expect((await transferRow(id)).status).toBe('COMPLETED');
    expect(await usage('2026-10-14')).toBe('5000000');
    expect(await usage('2026-10-15')).toBe('100000');
  });

  it('TRF-30 ejecución atrasada: si corre hasta las 09:00 del 15, la ejecuta a las 09:00 y consume el límite del 15', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set('2026-10-15T06:00:00.000Z'); // 09:00 del 15 en CDMX

    await runOnce();

    expect(await transferRow(id)).toMatchObject({
      status: 'COMPLETED',
      completed_at: new Date('2026-10-15T06:00:00.000Z'),
    });
    expect(await usage('2026-10-15')).toBe('100000');
  });

  it('TRF-30 una programada cuya fecha ya pasó se ejecuta en la siguiente pasada y consume el límite de ese día', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set('2026-10-16T16:00:00.000Z'); // 10:00 del 16: el proceso no corrió el 15

    await runOnce();

    expect((await transferRow(id)).status).toBe('COMPLETED');
    expect(await usage('2026-10-15')).toBeUndefined();
    expect(await usage('2026-10-16')).toBe('100000');
  });

  it('TRF-30 ejecuta en orden de scheduledFor y luego de creación: con saldo para dos, la última queda FAILED', async () => {
    await fund(t, ana.principal.id, '2000.00');
    const later = await schedule('1000.00', '2026-10-16T06:00:00.000Z', '1'); // creada primero, fecha posterior
    t.clock.advance(1_000);
    const first = await schedule('1000.00', '2026-10-15T06:00:00.000Z', '2');
    t.clock.advance(1_000);
    const second = await schedule('1000.00', '2026-10-15T06:00:00.000Z', '3');
    t.clock.set('2026-10-16T16:00:00.000Z');

    await runOnce();

    expect((await transferRow(first)).status).toBe('COMPLETED');
    expect((await transferRow(second)).status).toBe('COMPLETED');
    expect(await transferRow(later)).toMatchObject({
      status: 'FAILED',
      failure_reason: 'INSUFFICIENT_FUNDS',
    });
  });

  it('TRF-30 entre cuentas propias se completa con asientos propios y sin tocar el límite', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
      amount: '5000.00',
      concept: 'Ahorro',
      reference: '1',
      scheduledFor: '2026-10-20T06:00:00.000Z',
    });
    t.clock.set('2026-10-20T06:00:30.000Z');

    await runOnce();

    expect((await transferRow(res.body.id)).status).toBe('COMPLETED');
    expect((await entriesOf(res.body.id)).map((entry: { type: string }) => entry.type)).toEqual([
      'OWN_TRANSFER_OUT',
      'OWN_TRANSFER_IN',
    ]);
    expect(await balanceOf(harness, ana.ahorro.id)).toBe('5000.00');
    expect(await usage('2026-10-20')).toBeUndefined();
  });

  it('TRF-12 si la medianoche llega mientras espera los bloqueos, reintenta y consume el límite del día nuevo', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    // Pasada del 15 a las 23:59:59: las candidatas y la fila contador son del 15, pero cuando
    // obtiene los bloqueos ya es el 16. Revierte y reintenta con el contador del 16.
    t.clock.queue(
      '2026-10-16T05:59:59.000Z',
      '2026-10-16T05:59:59.900Z',
      '2026-10-16T06:00:00.100Z',
    );

    await runOnce();

    expect(await transferRow(id)).toMatchObject({
      status: 'COMPLETED',
      completed_at: new Date('2026-10-16T06:00:00.100Z'),
    });
    expect(await usage('2026-10-15')).toBeUndefined();
    expect(await usage('2026-10-16')).toBe('100000');
  });

  it('TRF-28 una programada confirmada después de medianoche se ejecuta en la siguiente pasada', async () => {
    await setup('2026-10-15T05:58:00.000Z'); // 23:58 del 14
    await fund(t, ana.principal.id, '20000.00');
    const res = await postTransfer(t, ana, toLuis('15000.00', '2026-10-15T06:10:00.000Z'));
    expect(res.body.status).toBe('PENDING_OTP');
    t.clock.set('2026-10-15T06:02:00.000Z'); // 00:02 del 15
    const confirmed = await confirmTransfer(t, ana, res.body.id, {
      otp: t.mailer.lastCode(ana.person.email),
    });
    expect(confirmed.body.status).toBe('SCHEDULED');
    t.clock.set('2026-10-15T06:11:00.000Z');

    await runOnce();

    expect((await transferRow(res.body.id)).status).toBe('COMPLETED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
  });

  it('TRF-28 una programada que nunca confirmó su OTP queda vencida y nunca se ejecuta', async () => {
    await fund(t, ana.principal.id, '20000.00');
    const res = await postTransfer(t, ana, toLuis('15000.00', '2026-10-15T06:00:00.000Z'));
    expect(res.body.status).toBe('PENDING_OTP');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    expect((await transferRow(res.body.id)).status).toBe('PENDING_OTP');
    expect(await entriesOf(res.body.id)).toEqual([]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
  });

  it('TRF-30 si el lote viene lleno, repite la pasada hasta que venga incompleto', async () => {
    t = await buildTestApp(harness, {
      now: OCT_14_NOON,
      config: { scheduler: { enabled: false, intervalMs: 60_000, batchSize: 2 } },
    });
    ana = await ledgerUser(t, harness);
    luis = await ledgerUser(t, harness);
    beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '5000.00');
    const ids = [];
    for (let i = 0; i < 5; i += 1)
      ids.push(await schedule('100.00', '2026-10-15T06:00:00.000Z', String(i)));
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);

    await runOnce();

    for (const id of ids) expect((await transferRow(id)).status).toBe('COMPLETED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('4500.00');
  });
});

describe('TRF-36 y AUD-08 auditoría de la ejecución', () => {
  it('AUD-08 TRANSFER_COMPLETED con actor SYSTEM, sin id de actor y con el dueño, el monto y la fecha en los metadatos', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);
    await runOnce();

    expect(await executionEvents(id)).toEqual([
      expect.objectContaining({
        action: 'TRANSFER_COMPLETED',
        actor_type: 'SYSTEM',
        actor_user_id: null,
        entity_type: 'transfer',
        entity_id: id,
        metadata: {
          userId: ana.userId,
          kind: 'THIRD_PARTY',
          amount: '1000.00',
          scheduledFor: '2026-10-15T06:00:00.000Z',
        },
      }),
    ]);
  });

  it('AUD-08 TRANSFER_FAILED con actor SYSTEM, el dueño, el motivo, el monto y la fecha', async () => {
    await fund(t, ana.principal.id, '10.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);
    await runOnce();

    expect(await executionEvents(id)).toEqual([
      expect.objectContaining({
        action: 'TRANSFER_FAILED',
        actor_type: 'SYSTEM',
        actor_user_id: null,
        metadata: {
          userId: ana.userId,
          reason: 'INSUFFICIENT_FUNDS',
          amount: '1000.00',
          scheduledFor: '2026-10-15T06:00:00.000Z',
        },
      }),
    ]);
  });

  it('TRF-31 una segunda pasada no vuelve a ejecutar lo que ya se ejecutó', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set(OCT_15_JUST_AFTER_MIDNIGHT);
    await runOnce();
    t.clock.advance(60_000);
    await runOnce();

    expect(await executionEvents(id)).toHaveLength(1);
    expect(await entriesOf(id)).toHaveLength(2);
    expect(await balanceOf(harness, ana.principal.id)).toBe('4000.00');
  });
});
