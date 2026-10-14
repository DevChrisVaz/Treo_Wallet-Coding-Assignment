import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashRefreshToken } from '../../../src/modules/identity/application/sessions.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
const DAY = 24 * 60 * 60_000;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function refresh(refreshToken: string) {
  const res = await request(t.app).post('/auth/refresh').send({ refreshToken });
  expectToMatchContract(res, 'refreshSession');
  return res;
}

async function tokenRow(token: string) {
  const [row] = await harness.migrator.query(
    `SELECT id, family_id, used_at, replaced_by, revoked_at, revoked_reason, expires_at
       FROM app.refresh_tokens WHERE token_hash = $1`,
    [hashRefreshToken(token)],
  );
  return row;
}

/** Tokens de la familia que todavía sirven: sin usar, sin revocar y vigentes. */
async function activeTokens(familyId: string) {
  return harness.migrator.query(
    `SELECT id FROM app.refresh_tokens
      WHERE family_id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2`,
    [familyId, t.clock.now()],
  );
}

/** Todos los tokens de la familia, usados o no, con su revocación. */
async function familyRows(
  familyId: string,
): Promise<{ used_at: Date | null; revoked_at: Date | null; revoked_reason: string | null }[]> {
  return harness.migrator.query(
    `SELECT used_at, revoked_at, revoked_reason FROM app.refresh_tokens
      WHERE family_id = $1 ORDER BY issued_at, id`,
    [familyId],
  );
}

describe('IDN-11 refresh token opaco con rotación', () => {
  it('IDN-11 un refresh vigente devuelve un par nuevo y marca el anterior como usado', async () => {
    const user = await verifiedUser(t);
    t.clock.advance(60_000);
    const res = await refresh(user.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.refreshToken).not.toBe(user.refreshToken);
    expect(res.body.accessToken).not.toBe(user.accessToken);
    const previous = await tokenRow(user.refreshToken);
    const next = await tokenRow(res.body.refreshToken);
    expect(previous.used_at).not.toBeNull();
    expect(previous.replaced_by).toBe(next.id);
    expect(next.family_id).toBe(previous.family_id);
    expect((await refresh(res.body.refreshToken)).status).toBe(200);
  });

  it('IDN-11 la familia vence a los 30 días de iniciada aunque se siga usando', async () => {
    const user = await verifiedUser(t);
    let token = user.refreshToken;
    for (let day = 6; day <= 24; day += 6) {
      t.clock.advance(6 * DAY);
      const res = await refresh(token);
      expect(res.status, `día ${day}`).toBe(200);
      token = res.body.refreshToken;
    }
    t.clock.advance(5 * DAY);
    const last = await refresh(token);
    expect(last.status).toBe(200);
    // Emitido el día 29, ya no vive 7 días: lo acota el fin de la familia (día 30).
    expect(last.body.refreshTokenExpiresAt).toBe('2026-11-12T18:00:00.000Z');
    t.clock.set('2026-11-12T18:00:01.000Z');
    const expired = await refresh(last.body.refreshToken);
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('SESSION_REVOKED');
  });

  it('IDN-11 un refresh token que no se usa en 7 días vence', async () => {
    const user = await verifiedUser(t);
    t.clock.advance(7 * DAY + 1_000);
    expect((await refresh(user.refreshToken)).body.code).toBe('SESSION_REVOKED');
  });

  it('IDN-11 un token desconocido responde 401 SESSION_REVOKED', async () => {
    const res = await refresh('x'.repeat(43));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
  });
});

describe('IDN-12 detección de reuso con ventana de gracia', () => {
  it('IDN-12 un reintento 3 segundos después recibe un par nuevo y revoca el sucesor perdido', async () => {
    const user = await verifiedUser(t);
    const first = await refresh(user.refreshToken);
    t.clock.advance(3_000);
    const retry = await refresh(user.refreshToken);
    expect(retry.status).toBe(200);
    expect(retry.body.refreshToken).not.toBe(first.body.refreshToken);
    const lost = await tokenRow(first.body.refreshToken);
    expect(lost).toMatchObject({ revoked_reason: 'GRACE_SUPERSEDED' });
    expect((await refresh(retry.body.refreshToken)).status).toBe(200);
  });

  it('IDN-12 un token usado hace más de 30 segundos revoca toda la familia y se audita', async () => {
    const user = await verifiedUser(t);
    const first = await refresh(user.refreshToken);
    const second = await refresh(first.body.refreshToken);
    t.clock.advance(31_000);
    const reuse = await refresh(user.refreshToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('SESSION_REVOKED');
    const row = await tokenRow(user.refreshToken);
    expect(await activeTokens(row.family_id)).toEqual([]);
    // activeTokens ignora los usados: aquí se comprueba que también ellos quedaron revocados.
    const rows = await familyRows(row.family_id);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.used_at !== null)).toHaveLength(2);
    expect(rows.map((r) => r.revoked_reason)).toEqual(Array(3).fill('REUSE_DETECTED'));
    expect((await refresh(second.body.refreshToken)).body.code).toBe('SESSION_REVOKED');
    expect((await refresh(first.body.refreshToken)).body.code).toBe('SESSION_REVOKED');
    const events = await auditEvents(harness.migrator);
    expect(events.find((event) => event.action === 'REFRESH_TOKEN_REUSE_DETECTED')).toMatchObject({
      metadata: { familyId: row.family_id },
    });
  });

  it('IDN-12 dentro de la ventana, si el sucesor ya se usó, es reuso y revoca la familia', async () => {
    const user = await verifiedUser(t);
    const first = await refresh(user.refreshToken);
    const second = await refresh(first.body.refreshToken);
    expect(second.status).toBe(200);
    t.clock.advance(3_000);
    const reuse = await refresh(user.refreshToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('SESSION_REVOKED');
    const row = await tokenRow(user.refreshToken);
    // Los dos tokens usados y el vigente quedan revocados.
    const rows = await familyRows(row.family_id);
    expect(rows.map((r) => r.revoked_reason)).toEqual(Array(3).fill('REUSE_DETECTED'));
    expect((await refresh(second.body.refreshToken)).body.code).toBe('SESSION_REVOKED');
    const events = await auditEvents(harness.migrator);
    expect(events.filter((e) => e.action === 'REFRESH_TOKEN_REUSE_DETECTED')).toMatchObject([
      { actor_type: 'ANONYMOUS', entity_id: user.userId, metadata: { familyId: row.family_id } },
    ]);
  });

  it('IDN-12 exactamente 30 segundos después todavía es un reintento', async () => {
    const user = await verifiedUser(t);
    const first = await refresh(user.refreshToken);
    t.clock.advance(30_000);
    const retry = await refresh(user.refreshToken);
    expect(retry.status).toBe(200);
    expect(retry.body.refreshToken).not.toBe(first.body.refreshToken);
    expect(await tokenRow(first.body.refreshToken)).toMatchObject({
      revoked_reason: 'GRACE_SUPERSEDED',
    });
  });

  it('IDN-12 la ventana se mide desde el primer uso, no desde el último reintento', async () => {
    const user = await verifiedUser(t);
    await refresh(user.refreshToken);
    t.clock.advance(20_000);
    const retry = await refresh(user.refreshToken);
    expect(retry.status).toBe(200);
    // 40 s después del primer uso (20 s después del reintento): fuera de la ventana.
    t.clock.advance(20_000);
    const late = await refresh(user.refreshToken);
    expect(late.status).toBe(401);
    expect(late.body.code).toBe('SESSION_REVOKED');
    const row = await tokenRow(user.refreshToken);
    // El sucesor perdido ya estaba revocado por la gracia; los otros dos caen por el reuso.
    expect((await familyRows(row.family_id)).map((r) => r.revoked_reason).sort()).toEqual([
      'GRACE_SUPERSEDED',
      'REUSE_DETECTED',
      'REUSE_DETECTED',
    ]);
    expect((await refresh(retry.body.refreshToken)).body.code).toBe('SESSION_REVOKED');
  });

  it('IDN-12 dentro de la ventana, si el sucesor ya está revocado, es reuso y revoca la familia', async () => {
    const user = await verifiedUser(t);
    const first = await refresh(user.refreshToken);
    await harness.migrator.query(
      `UPDATE app.refresh_tokens SET revoked_at = $2, revoked_reason = 'GRACE_SUPERSEDED'
        WHERE token_hash = $1`,
      [hashRefreshToken(first.body.refreshToken), t.clock.now()],
    );
    t.clock.advance(3_000);
    const reuse = await refresh(user.refreshToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('SESSION_REVOKED');
    const row = await tokenRow(user.refreshToken);
    const rows = await familyRows(row.family_id);
    // Solo el sucesor ya estaba revocado por otra razón; el resto cae por el reuso.
    expect(rows.map((r) => r.revoked_reason).sort()).toEqual([
      'GRACE_SUPERSEDED',
      'REUSE_DETECTED',
    ]);
    const events = await auditEvents(harness.migrator);
    expect(events.filter((e) => e.action === 'REFRESH_TOKEN_REUSE_DETECTED')).toHaveLength(1);
  });

  it('IDN-12 dos refresh simultáneos con el mismo token responden 200 y dejan un solo token vigente', async () => {
    const user = await verifiedUser(t);
    const responses = await Promise.all([refresh(user.refreshToken), refresh(user.refreshToken)]);
    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    const row = await tokenRow(user.refreshToken);
    expect(await activeTokens(row.family_id)).toHaveLength(1);
  });
});
