import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { newRegistration } from '../../helpers/factories.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

function login(ip: string, email: string, password: string) {
  return request(t.app).post('/auth/login').set('X-Forwarded-For', ip).send({ email, password });
}

describe('IDN-15 límites de tasa en identidad', () => {
  it('IDN-15 el sexto intento de login con el mismo email desde una IP responde 429', async () => {
    const user = await verifiedUser(t);
    for (let i = 0; i < 5; i += 1) {
      expect((await login('198.51.100.1', user.person.email, 'equivocada')).status).toBe(401);
    }
    const sixth = await login('198.51.100.1', user.person.email, user.person.password);
    expectToMatchContract(sixth, 'login');
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe('RATE_LIMITED');
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('IDN-15 no bloquea la cuenta: el usuario entra desde otra IP con su contraseña', async () => {
    const user = await verifiedUser(t);
    for (let i = 0; i < 6; i += 1) await login('198.51.100.1', user.person.email, 'equivocada');
    const own = await login('203.0.113.77', user.person.email, user.person.password);
    expect(own.status).toBe(200);
  });

  it('IDN-15 la ventana de login se reinicia a los 15 minutos', async () => {
    const user = await verifiedUser(t);
    for (let i = 0; i < 6; i += 1) await login('198.51.100.1', user.person.email, 'equivocada');
    t.clock.advance(15 * 60_000);
    expect((await login('198.51.100.1', user.person.email, user.person.password)).status).toBe(200);
  });

  it('IDN-15 una IP no puede hacer más de 20 intentos de login aunque cambie de email', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await login('198.51.100.9', `nadie${i}@example.com`, 'x')).status).toBe(401);
    }
    expect((await login('198.51.100.9', 'otro@example.com', 'x')).status).toBe(429);
  });

  it.each([
    ['/auth/register', 'registerUser', () => newRegistration()],
    ['/auth/verify-email', 'verifyEmail', () => ({ email: 'nadie@example.com', code: '123456' })],
    [
      '/auth/verify-email/resend',
      'resendVerificationEmail',
      () => ({ email: 'nadie@example.com' }),
    ],
  ])('IDN-15 %s admite 10 peticiones por IP por hora', async (path, operationId, body) => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(t.app)
        .post(path)
        .set('X-Forwarded-For', '198.51.100.20')
        .send(body());
      expect(res.status).not.toBe(429);
    }
    const limited = await request(t.app)
      .post(path)
      .set('X-Forwarded-For', '198.51.100.20')
      .send(body());
    expectToMatchContract(limited, operationId);
    expect(limited.status).toBe(429);
    const otherIp = await request(t.app)
      .post(path)
      .set('X-Forwarded-For', '198.51.100.21')
      .send(body());
    expect(otherIp.status).not.toBe(429);
    t.clock.advance(60 * 60_000);
    const later = await request(t.app)
      .post(path)
      .set('X-Forwarded-For', '198.51.100.20')
      .send(body());
    expect(later.status).not.toBe(429);
  });
});
