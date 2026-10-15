import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testRateLimits, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness, {
    config: { rateLimits: testRateLimits({ refreshMax: 3, logoutMax: 2 }) },
  });
});

function refresh(ip: string, refreshToken: string) {
  return request(t.app).post('/auth/refresh').set('X-Forwarded-For', ip).send({ refreshToken });
}

function logout(ip: string, refreshToken: string) {
  return request(t.app).post('/auth/logout').set('X-Forwarded-For', ip).send({ refreshToken });
}

const UNKNOWN = 'x'.repeat(43);

describe('IDN-17 límites de refresh y logout', () => {
  it('IDN-17 la renovación que excede el tope responde 429 RATE_LIMITED con Retry-After', async () => {
    for (let i = 0; i < 3; i += 1)
      expect((await refresh('198.51.100.1', UNKNOWN)).status).toBe(401);
    const res = await refresh('198.51.100.1', UNKNOWN);
    expectToMatchContract(res, 'refreshSession');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('IDN-17 el cierre de sesión que excede el tope responde 429 RATE_LIMITED con Retry-After', async () => {
    for (let i = 0; i < 2; i += 1) expect((await logout('198.51.100.2', UNKNOWN)).status).toBe(204);
    const res = await logout('198.51.100.2', UNKNOWN);
    expectToMatchContract(res, 'logout');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('IDN-17 un rechazo por límite no consume el refresh token y la ventana lo libera', async () => {
    const user = await verifiedUser(t);
    for (let i = 0; i < 3; i += 1) await refresh('198.51.100.3', UNKNOWN);
    expect((await refresh('198.51.100.3', user.refreshToken)).status).toBe(429);
    t.clock.advance(15 * 60_000);
    const ok = await refresh('198.51.100.3', user.refreshToken);
    expect(ok.status).toBe(200);
  });

  it('IDN-17 el contador es por IP: otra IP renueva aunque la primera haya agotado el suyo', async () => {
    const user = await verifiedUser(t);
    for (let i = 0; i < 4; i += 1) await refresh('198.51.100.4', UNKNOWN);
    expect((await refresh('203.0.113.9', user.refreshToken)).status).toBe(200);
  });

  it('IDN-17 refresh y logout llevan contadores distintos', async () => {
    for (let i = 0; i < 4; i += 1) await refresh('198.51.100.5', UNKNOWN);
    expect((await logout('198.51.100.5', UNKNOWN)).status).toBe(204);
  });

  it('IDN-17 la ventana de 15 minutos se reinicia', async () => {
    for (let i = 0; i < 4; i += 1) await logout('198.51.100.6', UNKNOWN);
    t.clock.advance(15 * 60_000);
    expect((await logout('198.51.100.6', UNKNOWN)).status).toBe(204);
  });
});
