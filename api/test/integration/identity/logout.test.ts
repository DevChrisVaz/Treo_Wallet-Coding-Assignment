import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function logout(refreshToken: string) {
  const res = await request(t.app).post('/auth/logout').send({ refreshToken });
  expectToMatchContract(res, 'logout');
  return res;
}

async function refresh(refreshToken: string) {
  return request(t.app).post('/auth/refresh').send({ refreshToken });
}

describe('IDN-13 cierre de sesión', () => {
  it('IDN-13 después del logout ningún refresh token de la familia sirve', async () => {
    const user = await verifiedUser(t);
    const rotated = await refresh(user.refreshToken);
    expect((await logout(rotated.body.refreshToken)).status).toBe(204);
    for (const token of [user.refreshToken, rotated.body.refreshToken]) {
      const res = await refresh(token);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('SESSION_REVOKED');
    }
  });

  it('IDN-13 un logout repetido con el mismo token también responde 204', async () => {
    const user = await verifiedUser(t);
    expect((await logout(user.refreshToken)).status).toBe(204);
    expect((await logout(user.refreshToken)).status).toBe(204);
  });

  it('IDN-13 un token desconocido responde 204 sin cambios', async () => {
    expect((await logout('y'.repeat(43))).status).toBe(204);
  });

  it('IDN-13 un refresh token vencido también responde 204 y no sirve', async () => {
    const user = await verifiedUser(t);
    t.clock.advance(7 * 24 * 60 * 60_000 + 1_000);
    expect((await logout(user.refreshToken)).status).toBe(204);
    const res = await refresh(user.refreshToken);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  it('IDN-13 no cierra otras sesiones del mismo usuario', async () => {
    const user = await verifiedUser(t);
    const other = await request(t.app)
      .post('/auth/login')
      .send({ email: user.person.email, password: user.person.password });
    await logout(user.refreshToken);
    expect((await refresh(other.body.tokens.refreshToken)).status).toBe(200);
  });

  it('AUD-01 audita LOGOUT una sola vez aunque se repita', async () => {
    const user = await verifiedUser(t);
    await logout(user.refreshToken);
    await logout(user.refreshToken);
    const events = (await auditEvents(harness.migrator)).filter((e) => e.action === 'LOGOUT');
    expect(events).toMatchObject([{ actor_type: 'USER', actor_user_id: user.userId }]);
  });
});
