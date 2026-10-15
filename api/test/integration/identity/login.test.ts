import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PasswordHasher } from '../../../src/modules/identity/application/ports.js';
import { Argon2PasswordHasher } from '../../../src/modules/identity/infrastructure/argon2-password-hasher.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson, verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
const calls = { verify: 0, verifyDummy: 0 };

beforeEach(async () => {
  const real = await Argon2PasswordHasher.create();
  calls.verify = 0;
  calls.verifyDummy = 0;
  const hasher: PasswordHasher = {
    hash: (password) => real.hash(password),
    verify: (hash, password) => {
      calls.verify += 1;
      return real.verify(hash, password);
    },
    verifyDummy: (password) => {
      calls.verifyDummy += 1;
      return real.verifyDummy(password);
    },
  };
  t = await buildTestApp(harness, { overrides: { hasher } });
});

async function login(email: string, password: string, headers: Record<string, string> = {}) {
  const res = await request(t.app).post('/auth/login').set(headers).send({ email, password });
  expectToMatchContract(res, 'login');
  return res;
}

function withoutRequestId(body: Record<string, unknown>) {
  const { requestId: _requestId, ...rest } = body;
  return rest;
}

describe('IDN-08 inicio de sesión sin enumeración', () => {
  it('IDN-08 con email y contraseña correctos y correo verificado devuelve usuario y tokens', async () => {
    const user = await verifiedUser(t);
    const res = await login(user.person.email, user.person.password);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.userId);
    expect(res.body.tokens.tokenType).toBe('Bearer');
  });

  it('IDN-08 email inexistente y contraseña incorrecta responden igual y ambos verifican un hash', async () => {
    const user = await verifiedUser(t);
    const unknown = await login('nadie@example.com', user.person.password);
    expect(calls.verifyDummy).toBe(1);
    const wrong = await login(user.person.email, 'contraseña equivocada');
    expect(calls.verify).toBe(1);
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    expect(withoutRequestId(unknown.body)).toEqual(withoutRequestId(wrong.body));
  });

  it('IDN-08 un usuario sin verificar con la contraseña correcta recibe 403 EMAIL_NOT_VERIFIED', async () => {
    const { person } = await registerPerson(t);
    const res = await login(person.email, person.password);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('IDN-08 un usuario sin verificar con contraseña incorrecta recibe el 401 genérico', async () => {
    const { person } = await registerPerson(t);
    expect((await login(person.email, 'contraseña equivocada')).status).toBe(401);
  });

  it('IDN-02 un email registrado con mayúsculas y espacios inicia sesión en minúsculas', async () => {
    const user = await verifiedUser(t, { email: '  Ana.Mayus@Example.COM ' });
    const res = await login('ana.mayus@example.com', user.person.password);
    expect(res.status).toBe(200);
  });
});

describe('AUD-01 auditoría del inicio de sesión', () => {
  it('AUD-01 un login exitoso deja LOGIN_SUCCEEDED con usuario, requestId, IP y user agent', async () => {
    const user = await verifiedUser(t);
    await login(user.person.email, user.person.password, {
      'X-Request-Id': 'req-login-1',
      'X-Forwarded-For': '203.0.113.50',
      'User-Agent': 'WalletApp/1.0',
    });
    const events = await auditEvents(harness.migrator);
    expect(events.at(-1)).toMatchObject({
      action: 'LOGIN_SUCCEEDED',
      actor_type: 'USER',
      actor_user_id: user.userId,
      request_id: 'req-login-1',
      ip: '203.0.113.50',
      user_agent: 'WalletApp/1.0',
    });
  });

  it('AUD-06 un login con email inexistente deja LOGIN_FAILED anónimo con su motivo', async () => {
    await login('nadie@example.com', 'una contraseña cualquiera');
    const events = await auditEvents(harness.migrator);
    expect(events).toMatchObject([
      {
        action: 'LOGIN_FAILED',
        actor_type: 'ANONYMOUS',
        actor_user_id: null,
        entity_id: null,
        metadata: { reason: 'UNKNOWN_EMAIL' },
      },
    ]);
  });

  it('AUD-01 un usuario sin verificar deja LOGIN_FAILED con motivo EMAIL_NOT_VERIFIED', async () => {
    const { person } = await registerPerson(t);
    const res = await login(person.email, person.password);
    expect(res.status).toBe(403);
    const [user] = await harness.migrator.query('SELECT id FROM app.users WHERE email = $1', [
      person.email,
    ]);
    const events = await auditEvents(harness.migrator);
    expect(events.at(-1)).toMatchObject({
      action: 'LOGIN_FAILED',
      actor_type: 'ANONYMOUS',
      entity_id: user.id,
      metadata: { reason: 'EMAIL_NOT_VERIFIED' },
    });
  });

  it('AUD-01 una contraseña incorrecta deja LOGIN_FAILED con el usuario afectado como entidad', async () => {
    const user = await verifiedUser(t);
    await login(user.person.email, 'contraseña equivocada');
    const events = await auditEvents(harness.migrator);
    expect(events.at(-1)).toMatchObject({
      action: 'LOGIN_FAILED',
      actor_type: 'ANONYMOUS',
      entity_id: user.userId,
      metadata: { reason: 'INVALID_PASSWORD' },
    });
  });
});

describe('IDN-08 inicio de sesión de un registro en revisión', () => {
  /** Registra a alguien con el teléfono de otro usuario y verifica su correo: queda en revisión. */
  async function inReviewPerson() {
    const owner = await verifiedUser(t);
    const { person, code } = await registerPerson(t, { phone: owner.person.phone });
    const verified = await request(t.app)
      .post('/auth/verify-email')
      .send({ email: person.email, code });
    expect(verified.status).toBe(403);
    return person;
  }

  it('IDN-08 con la contraseña correcta recibe 403 REGISTRATION_IN_REVIEW sin tokens', async () => {
    const person = await inReviewPerson();
    const res = await login(person.email, person.password);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REGISTRATION_IN_REVIEW');
    expect(res.body.tokens).toBeUndefined();
  });

  it('IDN-08 con una contraseña incorrecta recibe el 401 genérico', async () => {
    const person = await inReviewPerson();
    const res = await login(person.email, `${person.password}x`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('AUD-01 deja LOGIN_FAILED con motivo REGISTRATION_IN_REVIEW', async () => {
    const person = await inReviewPerson();
    await login(person.email, person.password);
    const [user] = await harness.migrator.query('SELECT id FROM app.users WHERE email = $1', [
      person.email,
    ]);
    const events = await auditEvents(harness.migrator);
    expect(events.at(-1)).toMatchObject({
      action: 'LOGIN_FAILED',
      actor_type: 'ANONYMOUS',
      entity_id: user.id,
      metadata: { reason: 'REGISTRATION_IN_REVIEW' },
    });
  });
});
