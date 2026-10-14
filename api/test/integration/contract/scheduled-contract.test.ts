import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { addBeneficiary, authed, fund, ledgerUser } from '../../helpers/ledger-api.js';
import { insertScheduledTransfers, signInAgain } from '../../helpers/scheduled.js';

/**
 * Recorrido de contrato de scheduled-transfers (TRF-34): cada respuesta nueva o cambiada, de éxito y
 * de error. `authed` valida cada respuesta con Ajv contra la operación de su método y ruta; aquí
 * además se exigen las extensiones opcionales del Problem que el contrato promete para cada código.
 */
const harness = useIntegrationHarness();

describe('TRF-34 conformidad con el contrato de las programadas', () => {
  it('TRF-34 createTransfer, confirmTransfer, cancelTransfer, listScheduledTransfers y getTransfer cumplen el contrato', async () => {
    const t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
    let ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '500.00');
    const seen = new Set<string>();
    const record = <R extends { status: number }>(operation: string, res: R): R => {
      seen.add(`${operation} ${res.status}`);
      return res;
    };
    let api = authed(t, ana.accessToken);
    const body = (amount: string, scheduledFor: string) => ({
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount,
      concept: 'Renta',
      reference: '1',
      scheduledFor,
    });

    // createTransfer: 201 SCHEDULED, 201 PENDING_OTP con fecha, 200 de reintento, 422 de validación.
    const key = randomUUID();
    const scheduled = record(
      'createTransfer',
      await api.post('/transfers').set('Idempotency-Key', key).send(body('1000.00', '2026-10-15')),
    );
    expect(scheduled.status).toBe(201);
    expect(scheduled.body).toMatchObject({ status: 'SCHEDULED', scheduledFor: '2026-10-15' });
    const replay = record(
      'createTransfer',
      await api.post('/transfers').set('Idempotency-Key', key).send(body('1000.00', '2026-10-15')),
    );
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    const withOtp = await api
      .post('/transfers')
      .set('Idempotency-Key', randomUUID())
      .send(body('15000.00', '2026-10-20'));
    expect(withOtp.body).toMatchObject({ status: 'PENDING_OTP', scheduledFor: '2026-10-20' });
    const outOfRange = record(
      'createTransfer',
      await api
        .post('/transfers')
        .set('Idempotency-Key', randomUUID())
        .send(body('1000.00', '2026-10-14')),
    );
    expect(outOfRange.status).toBe(422);
    expect(outOfRange.body.errors).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
    ]);

    // confirmTransfer: 200 con SCHEDULED.
    const confirmed = record(
      'confirmTransfer',
      await api
        .post(`/transfers/${withOtp.body.id}/confirm`)
        .send({ otp: t.mailer.lastCode(ana.person.email) }),
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('SCHEDULED');

    // listScheduledTransfers: 200.
    const list = record('listScheduledTransfers', await api.get('/transfers/scheduled'));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);

    // cancelTransfer: 200, 200 otra vez, 404 ajena.
    const cancelled = record(
      'cancelTransfer',
      await api.post(`/transfers/${withOtp.body.id}/cancel`),
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelledAt: expect.any(String) });
    expect(
      record('cancelTransfer', await api.post(`/transfers/${withOtp.body.id}/cancel`)).status,
    ).toBe(200);
    const foreign = record(
      'cancelTransfer',
      await authed(t, luis.accessToken).post(`/transfers/${scheduled.body.id}/cancel`),
    );
    expect(foreign.status).toBe(404);

    // createTransfer 422 SCHEDULED_LIMIT_REACHED con 20 activas.
    await insertScheduledTransfers(harness.migrator, ana, 19);
    const capped = record(
      'createTransfer',
      await api
        .post('/transfers')
        .set('Idempotency-Key', randomUUID())
        .send(body('1.00', '2026-10-15')),
    );
    expect(capped.status).toBe(422);
    expect(capped.body.code).toBe('SCHEDULED_LIMIT_REACHED');

    // Ejecución (falla por saldo: 500.00 < 1000.00) y comprobantes de cada estado.
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);
    api = authed(t, ana.accessToken);
    const failed = record('getTransfer', await api.get(`/transfers/${scheduled.body.id}`));
    expect(failed.body).toMatchObject({ status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' });
    const cancelledShown = record('getTransfer', await api.get(`/transfers/${withOtp.body.id}`));
    expect(cancelledShown.body.status).toBe('CANCELLED');

    // cancelTransfer 409 con transferStatus.
    const notCancellable = record(
      'cancelTransfer',
      await api.post(`/transfers/${scheduled.body.id}/cancel`),
    );
    expect(notCancellable.status).toBe(409);
    expect(notCancellable.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'FAILED',
    });

    expect([...seen].sort()).toEqual(
      [
        'cancelTransfer 200',
        'cancelTransfer 404',
        'cancelTransfer 409',
        'confirmTransfer 200',
        'createTransfer 200',
        'createTransfer 201',
        'createTransfer 422',
        'getTransfer 200',
        'listScheduledTransfers 200',
      ].sort(),
    );
  });
});
