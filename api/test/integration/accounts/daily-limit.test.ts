import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();

async function setUsage(userId: string, day: string, usedCents: number, limitCents = 5000000) {
  await harness.migrator.query(
    `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
     VALUES ($1, $2, $3, $4)`,
    [userId, day, usedCents, limitCents],
  );
}

describe('ACC-11 estado del límite diario en el resumen de cuentas', () => {
  it('ACC-11 a las 17:00 del 2026-10-13 en CDMX, usa la fila de ese día y reinicia a las 06:00 UTC', async () => {
    // 17:00 en CDMX = 23:00 UTC.
    const t = await buildTestApp(harness, { now: '2026-10-13T23:00:00.000Z' });
    const ana = await verifiedUser(t);
    await setUsage(ana.userId, '2026-10-13', 1_200_000);
    await setUsage(ana.userId, '2026-10-12', 4_000_000);
    const res = await request(t.app)
      .get('/accounts')
      .set('Authorization', `Bearer ${ana.accessToken}`);
    expectToMatchContract(res, 'listAccounts');
    expect(res.body.dailyLimit).toEqual({
      limit: '50000.00',
      used: '12000.00',
      remaining: '38000.00',
      resetsAt: '2026-10-14T06:00:00.000Z',
      timeZone: 'America/Mexico_City',
    });
  });

  it('ACC-11 el límite guardado en la fila del día manda sobre el de la configuración', async () => {
    // La configuración de prueba tiene 50,000.00; la fila del día guardó 30,000.00 al crearse.
    const t = await buildTestApp(harness, { now: '2026-10-13T23:00:00.000Z' });
    const ana = await verifiedUser(t);
    await setUsage(ana.userId, '2026-10-13', 1_000_000, 3_000_000);
    const res = await request(t.app)
      .get('/accounts')
      .set('Authorization', `Bearer ${ana.accessToken}`);
    expectToMatchContract(res, 'listAccounts');
    expect(res.body.dailyLimit).toMatchObject({
      limit: '30000.00',
      used: '10000.00',
      remaining: '20000.00',
    });
  });

  it('ACC-11 sin fila del día, el uso es 0 y queda todo el límite', async () => {
    const t = await buildTestApp(harness, { now: '2026-10-13T23:00:00.000Z' });
    const ana = await verifiedUser(t);
    const res = await request(t.app)
      .get('/accounts')
      .set('Authorization', `Bearer ${ana.accessToken}`);
    expect(res.body.dailyLimit).toMatchObject({ used: '0.00', remaining: '50000.00' });
  });

  it('TRF-12 a las 18:30 de CDMX (00:30 UTC del día siguiente) sigue contando el día de CDMX', async () => {
    const t = await buildTestApp(harness, { now: '2026-10-14T00:30:00.000Z' });
    const ana = await verifiedUser(t);
    await setUsage(ana.userId, '2026-10-13', 5_000_000);
    const res = await request(t.app)
      .get('/accounts')
      .set('Authorization', `Bearer ${ana.accessToken}`);
    expect(res.body.dailyLimit).toMatchObject({ used: '50000.00', remaining: '0.00' });
  });
});
