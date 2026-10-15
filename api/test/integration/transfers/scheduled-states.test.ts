import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

async function schedule(amount: string, scheduledFor = '2026-10-15T06:00:00.000Z') {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Renta',
    reference: '1',
    scheduledFor,
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function historyIds(owner: LedgerUser, accountId: string): Promise<string[]> {
  const res = await authed(t, owner.accessToken).get(`/accounts/${accountId}/movements`);
  expect(res.status).toBe(200);
  return res.body.items.map((item: { transferId: string | null }) => item.transferId);
}

async function remainingToday(owner: LedgerUser): Promise<string> {
  const res = await authed(t, owner.accessToken).get('/accounts');
  expect(res.status).toBe(200);
  return res.body.dailyLimit.remaining;
}

const getTransfer = (owner: LedgerUser, id: string) =>
  authed(t, owner.accessToken).get(`/transfers/${id}`);

describe('TRF-34 las programadas fuera del historial y del límite', () => {
  it('TRF-34 una programada no aparece en el historial de Ana ni en el de Luis', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    expect(await historyIds(ana, ana.principal.id)).not.toContain(id);
    expect(await historyIds(luis, luis.principal.id)).not.toContain(id);
  });

  it('TRF-34 ni la programada, ni la que espera su OTP, ni la cancelada consumen el límite diario', async () => {
    const scheduled = await schedule('10000.00');
    await schedule('15000.00'); // PENDING_OTP
    expect(await remainingToday(ana)).toBe('50000.00');
    await authed(t, ana.accessToken).post(`/transfers/${scheduled}/cancel`);
    expect(await remainingToday(ana)).toBe('50000.00');
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.daily_transfer_usage WHERE user_id = $1`,
      [ana.userId],
    );
    expect(n).toBe(0);
  });

  it('TRF-34 al ejecutarse, sí aparece en el historial con la fecha de ejecución', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    expect(await historyIds(ana, ana.principal.id)).toContain(id);
  });
});

describe('TRF-34 comprobante de una programada', () => {
  it('TRF-34 una SCHEDULED muestra scheduledFor y cancelledAt nulo', async () => {
    const id = await schedule('1000.00');
    const res = await getTransfer(ana, id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      scheduledFor: '2026-10-15T06:00:00.000Z',
      cancelledAt: null,
      completedAt: null,
    });
  });

  it('TRF-34 una programada ejecutada muestra COMPLETED, scheduledFor y completedAt', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    const res = await getTransfer(ana, id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'COMPLETED',
      scheduledFor: '2026-10-15T06:00:00.000Z',
      completedAt: '2026-10-15T06:00:30.000Z',
      cancelledAt: null,
    });
  });

  it('TRF-34 una programada que falló al ejecutarse muestra FAILED con su motivo y scheduledFor', async () => {
    const id = await schedule('1000.00');
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    const res = await getTransfer(ana, id);
    expect(res.body).toMatchObject({
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
      scheduledFor: '2026-10-15T06:00:00.000Z',
      completedAt: null,
    });
  });

  it('TRF-34 una cancelada muestra CANCELLED, scheduledFor y cancelledAt', async () => {
    const id = await schedule('1000.00');
    t.clock.advance(30_000);
    await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`);
    const res = await getTransfer(ana, id);
    expect(res.body).toMatchObject({
      status: 'CANCELLED',
      scheduledFor: '2026-10-15T06:00:00.000Z',
      cancelledAt: '2026-10-14T18:00:30.000Z',
    });
  });

  it('TRF-34 una inmediata sigue con scheduledFor y cancelledAt nulos', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount: '100.00',
      concept: 'Ahora',
      reference: '1',
    });
    const shown = await getTransfer(ana, res.body.id);
    expect(shown.body).toMatchObject({
      status: 'COMPLETED',
      scheduledFor: null,
      cancelledAt: null,
    });
  });
});
