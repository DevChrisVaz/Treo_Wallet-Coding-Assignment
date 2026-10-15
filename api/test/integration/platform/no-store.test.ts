import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testRateLimits, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness, {
    config: { rateLimits: testRateLimits({ logoutMax: 1 }) },
  });
});

describe('PLT-20 respuestas sin caché', () => {
  it('PLT-20 la respuesta de login con tokens lleva Cache-Control: no-store', async () => {
    const user = await verifiedUser(t);
    const res = await request(t.app)
      .post('/auth/login')
      .send({ email: user.person.email.trim().toLowerCase(), password: user.person.password });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('PLT-20 una respuesta autenticada (GET /me) lleva no-store', async () => {
    const user = await verifiedUser(t);
    const res = await request(t.app).get('/me').set('Authorization', `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['401 UNAUTHENTICATED', () => request(t.app).get('/me'), 401],
    ['404 NOT_FOUND', () => request(t.app).get('/no-existe'), 404],
    [
      '422 VALIDATION_FAILED',
      () => request(t.app).post('/auth/login').send({ email: 'no', password: '' }),
      422,
    ],
    ['400 MALFORMED_REQUEST', () => request(t.app).post('/auth/login').type('json').send('{'), 400],
  ])('PLT-20 la respuesta de error %s lleva no-store', async (_name, call, status) => {
    const res = await call();
    expect(res.status).toBe(status);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('PLT-20 la respuesta 429 lleva no-store', async () => {
    const body = { refreshToken: 'x'.repeat(43) };
    await request(t.app).post('/auth/logout').send(body);
    const res = await request(t.app).post('/auth/logout').send(body);
    expect(res.status).toBe(429);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('PLT-20 GET /health lleva no-store', async () => {
    const res = await request(t.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('PLT-20 la documentación del contrato queda fuera: /openapi.yaml y /docs no lo llevan', async () => {
    const yaml = await request(t.app).get('/openapi.yaml');
    expect(yaml.status).toBe(200);
    expect(yaml.headers['cache-control']).not.toBe('no-store');
    const docs = await request(t.app).get('/docs/');
    expect(docs.status).toBe(200);
    expect(docs.headers['cache-control']).not.toBe('no-store');
  });
});
