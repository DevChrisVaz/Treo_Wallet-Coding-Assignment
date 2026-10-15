import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson, verifiedUser, type VerifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
let user: VerifiedUser;
let email: string;

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const SUBJECT = 'Iniciaste sesión en TreoWallet';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  user = await verifiedUser(t);
  email = user.person.email.trim().toLowerCase();
  t.mailer.clear();
});

async function login(headers: Record<string, string> = {}, password = user.person.password) {
  const req = request(t.app).post('/auth/login');
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  const res = await req.send({ email, password });
  await t.container.notices.drain(2_000);
  return res;
}

function notices() {
  return t.mailer.to(email).filter((message) => message.subject === SUBJECT);
}

describe('IDN-18 aviso de inicio de sesión', () => {
  it('IDN-18 un inicio de sesión desde Chrome en Windows envía un solo aviso con fecha, cliente e IP enmascarada', async () => {
    const res = await login({ 'User-Agent': CHROME_WINDOWS, 'X-Forwarded-For': '203.0.113.7' });
    expect(res.status).toBe(200);
    const [mail, ...rest] = notices();
    expect(rest).toHaveLength(0);
    expect(mail?.text).toContain('13 de octubre de 2026, 12:00');
    expect(mail?.text).toContain('hora de la Ciudad de México');
    expect(mail?.text).toContain('Chrome en Windows');
    expect(mail?.text).toContain('203.0.113.*');
    for (const part of [mail?.text, mail?.html, mail?.subject]) {
      expect(part).not.toContain('203.0.113.7');
      expect(part).not.toContain(user.person.password);
      expect(part).not.toContain(res.body.tokens.accessToken);
      expect(part).not.toContain(res.body.tokens.refreshToken);
      expect(part).not.toContain('Mozilla/5.0');
    }
  });

  it('IDN-18 desde la app en Android el aviso dice "la app de TreoWallet en Android"', async () => {
    await login({ 'User-Agent': 'TreoWallet-App/1.0.0 (android)' });
    expect(notices()[0]?.text).toContain('la app de TreoWallet en Android');
  });

  it('IDN-18 sin User-Agent o con uno desconocido el aviso dice "un dispositivo"', async () => {
    await login({ 'User-Agent': '' });
    await login({ 'User-Agent': 'curl/8.5.0' });
    const mails = notices();
    expect(mails).toHaveLength(2);
    for (const mail of mails) expect(mail.text).toContain('un dispositivo');
  });

  it('IDN-18 dice qué hacer si no fue la persona: responder el correo', async () => {
    await login({ 'User-Agent': CHROME_WINDOWS });
    const mail = notices()[0];
    expect(mail?.text).toMatch(/Si no fuiste tú, responde este correo/);
    expect(mail?.html).toContain('responde este correo');
  });

  it('IDN-18 cada inicio de sesión exitoso envía su aviso', async () => {
    await login();
    await login();
    expect(notices()).toHaveLength(2);
  });

  it('IDN-18 una contraseña incorrecta responde 401 y no envía nada', async () => {
    const res = await login({}, 'una-contraseña-equivocada-1');
    expect(res.status).toBe(401);
    expect(notices()).toHaveLength(0);
  });

  it('IDN-18 el 403 de correo sin verificar no envía el aviso', async () => {
    const { person } = await registerPerson(t);
    const pendingEmail = person.email.trim().toLowerCase();
    t.mailer.clear();
    const res = await request(t.app)
      .post('/auth/login')
      .send({ email: pendingEmail, password: person.password });
    await t.container.notices.drain(2_000);
    expect(res.status).toBe(403);
    expect(t.mailer.to(pendingEmail)).toHaveLength(0);
  });

  it('IDN-18 el 403 de un registro en revisión no envía el aviso', async () => {
    const owner = await verifiedUser(t);
    const { person, code } = await registerPerson(t, { phone: owner.person.phone });
    const reviewEmail = person.email.trim().toLowerCase();
    const verify = await request(t.app)
      .post('/auth/verify-email')
      .send({ email: reviewEmail, code });
    expect(verify.status).toBe(403);
    await t.container.notices.drain(2_000);
    t.mailer.clear();
    const res = await request(t.app)
      .post('/auth/login')
      .send({ email: reviewEmail, password: person.password });
    await t.container.notices.drain(2_000);
    expect(res.status).toBe(403);
    expect(t.mailer.to(reviewEmail)).toHaveLength(0);
  });

  it('IDN-18 refresh y la verificación del correo no envían el aviso', async () => {
    const refreshed = await request(t.app)
      .post('/auth/refresh')
      .send({ refreshToken: user.refreshToken });
    expect(refreshed.status).toBe(200);
    await t.container.notices.drain(2_000);
    expect(notices()).toHaveLength(0);
    const { person, code } = await registerPerson(t);
    const verify = await request(t.app)
      .post('/auth/verify-email')
      .send({ email: person.email.trim().toLowerCase(), code });
    expect(verify.status).toBe(200);
    await t.container.notices.drain(2_000);
    expect(t.mailer.to(person.email.trim().toLowerCase()).map((m) => m.subject)).not.toContain(
      SUBJECT,
    );
  });

  it('PLT-16 con el servidor de correo caído el inicio de sesión responde 200 igual y el log enmascara al destinatario', async () => {
    t.mailer.down = true;
    const res = await login({ 'User-Agent': CHROME_WINDOWS });
    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    const failure = t.logs.entries().find((entry) => entry.template === 'login-notice');
    expect(failure).toMatchObject({ msg: 'mail delivery failed' });
    expect(t.logs.text()).not.toContain(email);
  });

  it('PLT-16 el inicio de sesión no espera al servidor de correo', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    t.mailer.send = async () => {
      await blocked;
    };
    const res = await request(t.app)
      .post('/auth/login')
      .send({ email, password: user.person.password });
    expect(res.status).toBe(200);
    expect(t.container.notices.pending).toBe(1);
    release();
    await t.container.notices.drain(2_000);
  });
});
