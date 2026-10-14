import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
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

async function schedule(amount = '1000.00', scheduledFor = '2026-10-15T06:00:00.000Z') {
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

const cancel = (owner: LedgerUser, id: string) =>
  authed(t, owner.accessToken).post(`/transfers/${id}/cancel`);

async function rowOf(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT status, cancelled_at FROM app.transfers WHERE id = $1`,
    [id],
  );
  return row;
}

async function cancelEvents(id: string) {
  return (await auditEvents(harness.migrator)).filter(
    (event) => event.entity_id === id && event.action === 'TRANSFER_CANCELLED',
  );
}

describe('TRF-32 cancelación de una programada', () => {
  it('TRF-32 cancelar una SCHEDULED responde 200 con CANCELLED y cancelledAt', async () => {
    const id = await schedule();
    t.clock.advance(60_000);
    const res = await cancel(ana, id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'CANCELLED',
      scheduledFor: '2026-10-15T06:00:00.000Z',
      cancelledAt: '2026-10-14T18:01:00.000Z',
      completedAt: null,
      otp: null,
    });
    expect(await rowOf(id)).toEqual({
      status: 'CANCELLED',
      cancelled_at: new Date('2026-10-14T18:01:00.000Z'),
    });
  });

  it('AUD-08 la cancelación deja TRANSFER_CANCELLED con actor USER, el id de Ana y el transferId', async () => {
    const id = await schedule();
    await cancel(ana, id);
    expect(await cancelEvents(id)).toEqual([
      expect.objectContaining({
        actor_type: 'USER',
        actor_user_id: ana.userId,
        entity_type: 'transfer',
        entity_id: id,
        metadata: { amount: '1000.00', scheduledFor: '2026-10-15T06:00:00.000Z' },
      }),
    ]);
  });

  it('TRF-32 doble cancelación: la segunda responde 200 CANCELLED sin cambios ni otro evento', async () => {
    const id = await schedule();
    const first = await cancel(ana, id);
    t.clock.advance(60_000);
    const again = await cancel(ana, id);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ status: 'CANCELLED', cancelledAt: first.body.cancelledAt });
    expect(await cancelEvents(id)).toHaveLength(1);
  });

  it('TRF-32 una cancelada nunca se ejecuta en su fecha', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule();
    await cancel(ana, id);
    t.clock.set('2026-10-15T06:00:30.000Z');
    const pass = await t.container.scheduler.runner.runOnce();
    expect(pass).toEqual({ completed: 0, failed: 0, skipped: 0, errors: 0 });
    expect((await rowOf(id)).status).toBe('CANCELLED');
    const entries = await harness.migrator.query(
      `SELECT 1 FROM app.ledger_entries WHERE transfer_id = $1`,
      [id],
    );
    expect(entries).toEqual([]);
  });

  it('TRF-32 cancelar una programada ya ejecutada es 409 TRANSFER_NOT_CANCELLABLE con transferStatus COMPLETED', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule();
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    const res = await cancel(ana, id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'COMPLETED',
    });
    expect((await rowOf(id)).status).toBe('COMPLETED');
  });

  it('TRF-32 una programada FAILED tampoco se cancela: 409 con transferStatus FAILED', async () => {
    const id = await schedule();
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    const res = await cancel(ana, id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRANSFER_NOT_CANCELLABLE', transferStatus: 'FAILED' });
  });

  it('TRF-32 una inmediata COMPLETED no se cancela: 409 con transferStatus COMPLETED', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount: '100.00',
      concept: 'Ahora',
      reference: '1',
    });
    const cancelled = await cancel(ana, res.body.id);
    expect(cancelled.status).toBe(409);
    expect(cancelled.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'COMPLETED',
    });
  });

  it('TRF-32 una programada que espera su OTP no se cancela: 409 con PENDING_OTP, y vencida con EXPIRED', async () => {
    const id = await schedule('15000.00');
    const pending = await cancel(ana, id);
    expect(pending.status).toBe(409);
    expect(pending.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'PENDING_OTP',
    });
    t.clock.advance(5 * 60_000);
    const expired = await cancel(ana, id);
    expect(expired.status).toBe(409);
    expect(expired.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'EXPIRED',
    });
    expect((await rowOf(id)).status).toBe('PENDING_OTP');
  });

  it('TRF-32 cancelar una programada de otro usuario es 404 NOT_FOUND y no la cambia', async () => {
    const id = await schedule();
    const res = await cancel(luis, id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect((await rowOf(id)).status).toBe('SCHEDULED');
    expect(await cancelEvents(id)).toEqual([]);
  });

  it('TRF-32 un id mal formado o inexistente es 404 NOT_FOUND', async () => {
    expect((await cancel(ana, 'no-es-un-uuid')).status).toBe(404);
    expect((await cancel(ana, '6c3501fc-d2e5-4ae9-86ce-4e386e6ffb2d')).status).toBe(404);
  });
});
