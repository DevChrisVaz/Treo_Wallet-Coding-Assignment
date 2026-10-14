import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { ledgerUser, postTransfer, type LedgerUser } from '../../helpers/ledger-api.js';
import { insertScheduledTransfers } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
});

const toAhorro = (reference: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
  amount: '100.00',
  concept: 'Ahorro programado',
  reference,
  scheduledFor: '2026-10-20',
});

async function transfersOf(userId: string): Promise<number> {
  const [{ n }] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.transfers WHERE user_id = $1`,
    [userId],
  );
  return n;
}

describe('TRF-29 tope de 20 programadas activas', () => {
  it('TRF-29 en el tope, una programada mayor al umbral es SCHEDULED_LIMIT_REACHED sin código ni correo', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 20);
    const mailsBefore = t.mailer.to(ana.person.email).length;
    const res = await postTransfer(t, ana, { ...toAhorro('21'), amount: '15000.00' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SCHEDULED_LIMIT_REACHED');
    // El tope se revisa antes de emitir el OTP (TRF-28): ni fila de código ni correo.
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.one_time_codes WHERE purpose = 'TRANSFER_CONFIRMATION'`,
    );
    expect(n).toBe(0);
    expect(t.mailer.to(ana.person.email)).toHaveLength(mailsBefore);
    expect(await transfersOf(ana.userId)).toBe(20);
  });

  it('TRF-29 con 20 en SCHEDULED, la programada número 21 es 422 SCHEDULED_LIMIT_REACHED y no se guarda', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 20);
    const res = await postTransfer(t, ana, toAhorro('21'));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SCHEDULED_LIMIT_REACHED');
    expect(await transfersOf(ana.userId)).toBe(20);
  });

  it('TRF-29 con 19 en SCHEDULED, la número 20 sí se programa', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 19);
    const res = await postTransfer(t, ana, toAhorro('20'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('TRF-29 el rechazo por el tope no consume la llave: con un lugar libre, la misma llave programa', async () => {
    const [first] = await insertScheduledTransfers(harness.migrator, ana, 20);
    const key = randomUUID();
    const rejected = await postTransfer(t, ana, toAhorro('21'), key);
    expect(rejected.status).toBe(422);
    await harness.migrator.query(
      `UPDATE app.transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`,
      [first],
    );
    const retry = await postTransfer(t, ana, toAhorro('21'), key);
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
  });

  it('TRF-29 una programada en PENDING_OTP vigente cuenta para el tope', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 19);
    await insertScheduledTransfers(harness.migrator, ana, 1, {
      status: 'PENDING_OTP',
      otpExpiresAt: '2026-10-14T18:04:00.000Z',
    });
    const res = await postTransfer(t, ana, toAhorro('21'));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SCHEDULED_LIMIT_REACHED');
  });

  it('TRF-29 una programada en PENDING_OTP vencida no cuenta', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 19);
    await insertScheduledTransfers(harness.migrator, ana, 1, {
      status: 'PENDING_OTP',
      otpExpiresAt: '2026-10-14T18:00:00.000Z',
    });
    const res = await postTransfer(t, ana, toAhorro('21'));
    expect(res.status).toBe(201);
  });

  it('TRF-29 las canceladas, ejecutadas, fallidas y las inmediatas pendientes no cuentan', async () => {
    await insertScheduledTransfers(harness.migrator, ana, 19);
    await insertScheduledTransfers(harness.migrator, ana, 3, {
      status: 'CANCELLED',
      cancelledAt: '2026-10-14T17:00:00.000Z',
    });
    await insertScheduledTransfers(harness.migrator, ana, 3, {
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
    });
    await insertScheduledTransfers(harness.migrator, ana, 3, {
      status: 'PENDING_OTP',
      otpExpiresAt: '2026-10-14T18:04:00.000Z',
      scheduledFor: null,
    });
    const res = await postTransfer(t, ana, toAhorro('20'));
    expect(res.status).toBe(201);
  });

  it('TRF-29 las programadas de otro usuario no cuentan', async () => {
    const luis = await ledgerUser(t, harness);
    await insertScheduledTransfers(harness.migrator, luis, 20);
    const res = await postTransfer(t, ana, toAhorro('1'));
    expect(res.status).toBe(201);
  });
});
