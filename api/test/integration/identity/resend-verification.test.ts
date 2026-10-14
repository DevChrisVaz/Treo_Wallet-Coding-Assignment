import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { newRegistration } from '../../helpers/factories.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson, verifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function resend(email: string) {
  const res = await request(t.app).post('/auth/verify-email/resend').send({ email });
  expectToMatchContract(res, 'resendVerificationEmail');
  return res;
}

async function verify(email: string, code: string) {
  return request(t.app).post('/auth/verify-email').send({ email, code });
}

describe('IDN-07 reenvío del código de verificación', () => {
  it('IDN-07 un reenvío válido envía un código nuevo y audita EMAIL_VERIFICATION_RESENT', async () => {
    const { person } = await registerPerson(t);
    const res = await resend(person.email);
    expect(res.status).toBe(202);
    expect(t.mailer.to(person.email)).toHaveLength(2);
    const events = await auditEvents(harness.migrator);
    expect(events.map((event) => event.action)).toEqual([
      'USER_REGISTERED',
      'EMAIL_VERIFICATION_RESENT',
    ]);
  });

  it('IDN-05 el código anterior deja de servir después de un reenvío', async () => {
    const { person, code: first } = await registerPerson(t);
    await resend(person.email);
    const second = t.mailer.lastCode(person.email);
    if (second !== first) {
      expect((await verify(person.email, first)).body.code).toBe('VERIFICATION_CODE_INVALID');
    }
    expect((await verify(person.email, second)).status).toBe(200);
  });

  it('IDN-07 el cuarto reenvío responde 202 pero no envía ningún correo', async () => {
    const { person } = await registerPerson(t);
    for (let i = 0; i < 3; i += 1) expect((await resend(person.email)).status).toBe(202);
    expect(t.mailer.to(person.email)).toHaveLength(4);
    const fourth = await resend(person.email);
    expect(fourth.status).toBe(202);
    expect(t.mailer.to(person.email)).toHaveLength(4);
  });

  it('IDN-07 responde el mismo 202 sin enviar nada para un email desconocido o ya verificado', async () => {
    const { person } = await registerPerson(t);
    const known = await resend(person.email);
    const verified = await verifiedUser(t);
    t.mailer.clear();
    const unknown = await resend('nadie@example.com');
    const already = await resend(verified.person.email);
    expect(unknown.body).toEqual(known.body);
    expect(already.body).toEqual(known.body);
    expect(t.mailer.sent).toEqual([]);
  });

  it('PLT-16 si el correo falló al registrarse, el usuario puede pedir el reenvío cuando el servidor vuelve', async () => {
    t.mailer.down = true;
    const res = await request(t.app)
      .post('/auth/register')
      .send(newRegistration({ email: 'caido@example.com' }));
    expect(res.status).toBe(202);
    expect(t.mailer.to('caido@example.com')).toEqual([]);
    t.mailer.down = false;
    await resend('caido@example.com');
    const code = t.mailer.lastCode('caido@example.com');
    expect((await verify('caido@example.com', code)).status).toBe(200);
  });
});
