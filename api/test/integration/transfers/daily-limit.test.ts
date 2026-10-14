import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();

// La Ciudad de México está en UTC-6 todo el año (sin horario de verano desde 2022).
const CDMX = {
  noon: '2026-10-13T18:00:00.000Z',
  at1700: '2026-10-13T23:00:00.000Z',
  at1830: '2026-10-14T00:30:00.000Z', // 00:30 UTC del día siguiente
  at2359: '2026-10-14T05:59:00.000Z',
  justBeforeMidnight: '2026-10-14T05:59:59.500Z',
  justAfterMidnight: '2026-10-14T06:00:00.500Z',
  at0001: '2026-10-14T06:01:00.000Z',
};

interface Scene {
  readonly t: TestApp;
  readonly ana: LedgerUser;
  readonly beneficiaryId: string;
}

/** Ana con saldo suficiente y Luis como beneficiario, con el reloj en `now`. */
async function scene(now: string): Promise<Scene> {
  const t = await buildTestApp(harness, { now });
  const ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  const beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '70000.00');
  return { t, ana, beneficiaryId };
}

const toLuis = (s: Scene, amount: string) => ({
  fromAccountId: s.ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId: s.beneficiaryId },
  amount,
  concept: 'Pago',
  reference: '1',
});

/** Transferencias a terceros de hasta 10,000.00 (sin OTP) que suman `total`. */
async function spend(s: Scene, total: number): Promise<void> {
  for (let left = total; left > 0; left -= 10_000) {
    const res = await postTransfer(
      s.t,
      s.ana,
      toLuis(s, `${Math.min(left, 10_000)}.00`),
      randomUUID(),
    );
    expect(res.status).toBe(201);
  }
}

async function dailyLimit(s: Scene, user: LedgerUser = s.ana) {
  const res = await authed(s.t, user.accessToken).get('/accounts');
  expectToMatchContract(res, 'listAccounts');
  return res.body.dailyLimit;
}

async function usageByDay(userId: string): Promise<Record<string, string>> {
  const rows: { day: string; used_cents: string }[] = await harness.migrator.query(
    `SELECT day::text AS day, used_cents FROM app.daily_transfer_usage
      WHERE user_id = $1 ORDER BY day`,
    [userId],
  );
  return Object.fromEntries(rows.map((row) => [row.day, row.used_cents]));
}

/** Nueva sesión con el refresh token, para cuando el reloj avanzó más que la vida del token. */
async function refreshed(t: TestApp, user: LedgerUser): Promise<LedgerUser> {
  const res = await request(t.app).post('/auth/refresh').send({ refreshToken: user.refreshToken });
  expectToMatchContract(res, 'refreshSession');
  expect(res.status).toBe(200);
  return { ...user, accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

/** Espera a que alguna sesión de PostgreSQL esté bloqueada esperando un lock. */
async function waitForLockWait(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted',
    );
    if (n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Nadie quedó esperando el bloqueo');
}

describe('TRF-11 límite diario de transferencias a terceros', () => {
  it('TRF-11 con 40000.00 usados, enviar 10000.00 se completa y deja remaining en "0.00"', async () => {
    const s = await scene(CDMX.noon);
    await spend(s, 40_000);
    const res = await postTransfer(s.t, s.ana, toLuis(s, '10000.00'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(await dailyLimit(s)).toMatchObject({
      limit: '50000.00',
      used: '50000.00',
      remaining: '0.00',
    });
  });

  it('TRF-11 con 45000.00 usados, enviar 6000.00 es 422 DAILY_LIMIT_EXCEEDED con remaining "5000.00" y queda REJECTED', async () => {
    const s = await scene(CDMX.noon);
    await spend(s, 45_000);
    const res = await postTransfer(s.t, s.ana, toLuis(s, '6000.00'));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      remaining: '5000.00',
      transferId: expect.any(String),
    });
    const [row] = await harness.migrator.query(
      'SELECT status, rejection_reason FROM app.transfers WHERE id = $1',
      [res.body.transferId],
    );
    expect(row).toEqual({ status: 'REJECTED', rejection_reason: 'DAILY_LIMIT_EXCEEDED' });
    expect((await dailyLimit(s)).used).toBe('45000.00');
  });

  it('TRF-03 y TRF-11 repetir con la misma llave un rechazo por límite devuelve el mismo 422 con remaining recalculado', async () => {
    const s = await scene(CDMX.noon);
    await spend(s, 45_000);
    const key = randomUUID();
    const first = await postTransfer(s.t, s.ana, toLuis(s, '6000.00'), key);
    expect(first.status).toBe(422);
    expect(first.body.remaining).toBe('5000.00');

    // Después del rechazo se gastan 3000.00 más: el reintento ve lo que queda hoy, no lo de entonces.
    await spend(s, 3_000);
    const replay = await postTransfer(s.t, s.ana, toLuis(s, '6000.00'), key);
    expect(replay.status).toBe(422);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      transferId: first.body.transferId,
      remaining: '2000.00',
    });

    // Con el límite agotado, lo que queda es 0.00.
    await spend(s, 2_000);
    const exhausted = await postTransfer(s.t, s.ana, toLuis(s, '6000.00'), key);
    expect(exhausted.status).toBe(422);
    expect(exhausted.body).toMatchObject({ code: 'DAILY_LIMIT_EXCEEDED', remaining: '0.00' });
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.transfers WHERE idempotency_key = $1',
      [key],
    );
    expect(n).toBe(1);
  });

  it('TRF-11 y TRF-14 una transferencia con OTP que excede el límite se rechaza al crearla, sin código ni correo', async () => {
    const s = await scene(CDMX.noon);
    await spend(s, 45_000);
    const mailsBefore = s.t.mailer.sent.length;
    const res = await postTransfer(s.t, s.ana, toLuis(s, '12000.00'));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      remaining: '5000.00',
      transferId: expect.any(String),
    });
    const [row] = await harness.migrator.query(
      'SELECT status, rejection_reason, requires_otp, otp_expires_at FROM app.transfers WHERE id = $1',
      [res.body.transferId],
    );
    expect(row).toEqual({
      status: 'REJECTED',
      rejection_reason: 'DAILY_LIMIT_EXCEEDED',
      requires_otp: true,
      otp_expires_at: null,
    });
    const codes = await harness.migrator.query(
      'SELECT 1 FROM app.one_time_codes WHERE purpose = $1',
      ['TRANSFER_CONFIRMATION'],
    );
    expect(codes).toEqual([]);
    expect(s.t.mailer.sent.length).toBe(mailsBefore);
    expect((await dailyLimit(s)).used).toBe('45000.00');
  });

  it('TRF-11 con el límite agotado, 8000.00 entre cuentas propias se completa sin consumir límite', async () => {
    const s = await scene(CDMX.noon);
    await spend(s, 50_000);
    const res = await postTransfer(s.t, s.ana, {
      ...toLuis(s, '8000.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: s.ana.ahorro.id },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', kind: 'OWN' });
    expect((await dailyLimit(s)).used).toBe('50000.00');
  });
});

describe('TRF-12 día del límite en America/Mexico_City', () => {
  it('TRF-12 agotado a las 23:59 de CDMX, 1000.00 a las 00:01 se completa en el día nuevo', async () => {
    const s = await scene(CDMX.at2359);
    await spend(s, 50_000);
    s.t.clock.set(CDMX.at0001);
    const res = await postTransfer(s.t, s.ana, toLuis(s, '1000.00'));
    expect(res.status).toBe(201);
    expect(await usageByDay(s.ana.userId)).toEqual({
      '2026-10-13': '5000000',
      '2026-10-14': '100000',
    });
    expect(await dailyLimit(s)).toMatchObject({
      used: '1000.00',
      remaining: '49000.00',
      resetsAt: '2026-10-15T06:00:00.000Z',
    });
  });

  it('TRF-12 agotado a las 17:00 de CDMX, a las 18:30 (00:30 UTC del día siguiente) sigue siendo 422', async () => {
    const s = await scene(CDMX.at1700);
    await spend(s, 50_000);
    s.t.clock.set(CDMX.at1830);
    const ana = await refreshed(s.t, s.ana);
    const res = await postTransfer(s.t, ana, toLuis(s, '1000.00'));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'DAILY_LIMIT_EXCEEDED', remaining: '0.00' });
    expect(await usageByDay(s.ana.userId)).toEqual({ '2026-10-13': '5000000' });
  });

  it('TRF-12 si la medianoche llega mientras espera la fila contador, reintenta y consume el día nuevo', async () => {
    const s = await scene(CDMX.at2359);
    await spend(s, 50_000);
    const holder = harness.migrator.createQueryRunner();
    await holder.connect();
    try {
      await holder.startTransaction();
      await holder.query(
        `SELECT 1 FROM app.daily_transfer_usage
          WHERE user_id = $1 AND day = '2026-10-13' FOR UPDATE`,
        [s.ana.userId],
      );
      s.t.clock.set(CDMX.justBeforeMidnight);
      const key = randomUUID();
      const pending = postTransfer(s.t, s.ana, toLuis(s, '1000.00'), key);
      await waitForLockWait();
      s.t.clock.set(CDMX.justAfterMidnight);
      await holder.commitTransaction();
      const res = await pending;
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.completedAt).toBe(CDMX.justAfterMidnight);
      const [{ n }] = await harness.migrator.query(
        'SELECT count(*)::int AS n FROM app.transfers WHERE idempotency_key = $1',
        [key],
      );
      expect(n).toBe(1);
      expect(await usageByDay(s.ana.userId)).toEqual({
        '2026-10-13': '5000000',
        '2026-10-14': '100000',
      });
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }
  });
});
