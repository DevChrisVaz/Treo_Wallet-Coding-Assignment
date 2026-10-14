import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { JoseAccessTokens } from '../../../src/modules/identity/infrastructure/jose-access-tokens.js';
import { buildTestApp, testConfig, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson, verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

describe('IDN-14 datos del usuario autenticado', () => {
  it('IDN-14 devuelve sus datos con CURP, RFC y teléfono enmascarados', async () => {
    const user = await verifiedUser(t);
    const res = await request(t.app).get('/me').set('Authorization', `Bearer ${user.accessToken}`);
    expectToMatchContract(res, 'getCurrentUser');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.userId,
      email: user.person.email,
      fullName: user.person.fullName,
      phoneMasked: `+52******${user.person.phone.slice(-4)}`,
      curpMasked: `${user.person.curp.slice(0, 4)}**************`,
      rfcMasked: `${user.person.rfc.slice(0, 4)}*********`,
      emailVerifiedAt: '2026-10-13T18:00:00.000Z',
      createdAt: '2026-10-13T18:00:00.000Z',
    });
    const text = JSON.stringify(res.body);
    for (const value of [user.person.curp, user.person.rfc, user.person.phone]) {
      expect(text).not.toContain(value);
    }
  });

  it('IDN-10 GET /me sin header Authorization responde 401 UNAUTHENTICATED', async () => {
    const res = await request(t.app).get('/me');
    expectToMatchContract(res, 'getCurrentUser');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('IDN-10 un token válido de un usuario que ya no existe responde 401 UNAUTHENTICATED', async () => {
    const { person } = await registerPerson(t);
    const [{ id }] = await harness.migrator.query('SELECT id FROM app.users WHERE email = $1', [
      person.email,
    ]);
    const config = testConfig();
    const { token } = await new JoseAccessTokens({
      secret: config.jwtSecret,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }).issue(id, t.clock.now());
    const before = await request(t.app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    // El usuario sin verificar no tiene cuentas ni sesiones: solo su desafío cuelga de él.
    await harness.migrator.query('DELETE FROM app.one_time_codes WHERE subject_id = $1', [id]);
    await harness.migrator.query('DELETE FROM app.users WHERE id = $1', [id]);

    const res = await request(t.app).get('/me').set('Authorization', `Bearer ${token}`);
    expectToMatchContract(res, 'getCurrentUser');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('AUD-01 las lecturas no se auditan', async () => {
    const user = await verifiedUser(t);
    const before = (await auditEvents(harness.migrator)).length;
    await request(t.app).get('/me').set('Authorization', `Bearer ${user.accessToken}`);
    expect(await auditEvents(harness.migrator)).toHaveLength(before);
  });

  it('PLT-06 la línea de log de una petición autenticada lleva el usuario y no el token', async () => {
    const user = await verifiedUser(t);
    await request(t.app).get('/me').set('Authorization', `Bearer ${user.accessToken}`);
    const line = t.logs.entries().find((entry) => entry.path === '/me');
    expect(line).toMatchObject({ userId: user.userId, status: 200 });
    expect(t.logs.text()).not.toContain(user.accessToken);
  });
});
