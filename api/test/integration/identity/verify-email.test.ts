import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson, wrongCode } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function verify(email: string, code: string) {
  const res = await request(t.app).post('/auth/verify-email').send({ email, code });
  expectToMatchContract(res, 'verifyEmail');
  return res;
}

async function accountsOf(email: string) {
  return harness.migrator.query(
    `SELECT a.name FROM app.accounts a JOIN app.users u ON u.id = a.user_id
      WHERE u.email = $1 ORDER BY a.name`,
    [email],
  );
}

async function userByEmail(email: string) {
  const [user] = await harness.migrator.query(
    'SELECT id, email_verified_at FROM app.users WHERE email = $1',
    [email],
  );
  return user;
}

/** El cuerpo sin lo que cambia entre peticiones. */
function comparable(body: Record<string, unknown>) {
  const { requestId: _requestId, ...rest } = body;
  return rest;
}

describe('IDN-06 verificación de correo', () => {
  it('IDN-06 con el código vigente verifica, abre las dos cuentas y devuelve usuario y tokens', async () => {
    const { person, code } = await registerPerson(t);
    const res = await verify(person.email, code);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: person.email,
      fullName: person.fullName,
      emailVerifiedAt: '2026-10-13T18:00:00.000Z',
    });
    expect(res.body.tokens).toMatchObject({
      tokenType: 'Bearer',
      accessTokenExpiresAt: '2026-10-13T18:10:00.000Z',
      refreshTokenExpiresAt: '2026-10-20T18:00:00.000Z',
    });
    expect((await userByEmail(person.email)).email_verified_at).not.toBeNull();
    expect(await accountsOf(person.email)).toEqual([{ name: 'Ahorro' }, { name: 'Principal' }]);
  });

  it('IDN-11 el refresh token emitido se guarda solo como hash', async () => {
    const { person, code } = await registerPerson(t);
    const res = await verify(person.email, code);
    const token: string = res.body.tokens.refreshToken;
    const rows = await harness.migrator.query('SELECT token_hash FROM app.refresh_tokens');
    expect(rows).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex') }]);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('IDN-06 un código incorrecto responde 422 con los intentos restantes', async () => {
    const { person, code } = await registerPerson(t);
    const res = await verify(person.email, wrongCode(code));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'VERIFICATION_CODE_INVALID', attemptsRemaining: 2 });
  });

  it('IDN-06 al tercer fallo el código correcto ya no funciona', async () => {
    const { person, code } = await registerPerson(t);
    await verify(person.email, wrongCode(code));
    await verify(person.email, wrongCode(code));
    const third = await verify(person.email, wrongCode(code));
    expect(third.body).toMatchObject({ code: 'VERIFICATION_CODE_INVALID', attemptsRemaining: 0 });
    const correct = await verify(person.email, code);
    expect(correct.status).toBe(422);
    expect(correct.body).toMatchObject({ code: 'VERIFICATION_CODE_INVALID', attemptsRemaining: 0 });
    expect(await accountsOf(person.email)).toEqual([]);
  });

  it('IDN-06 un email desconocido responde igual que un código incorrecto', async () => {
    const { person, code } = await registerPerson(t);
    const wrong = await verify(person.email, wrongCode(code));
    const unknown = await verify('nadie@example.com', code);
    expect(unknown.status).toBe(wrong.status);
    expect(comparable(unknown.body)).toEqual(comparable(wrong.body));
  });

  it('ACC-04 una verificación repetida no abre cuentas adicionales y responde como código inválido', async () => {
    const { person, code } = await registerPerson(t);
    await verify(person.email, code);
    const again = await verify(person.email, code);
    expect(again.status).toBe(422);
    expect(again.body.code).toBe('VERIFICATION_CODE_INVALID');
    expect(await accountsOf(person.email)).toHaveLength(2);
  });

  it('ACC-04 un usuario que no ha verificado su correo no tiene cuentas', async () => {
    const { person } = await registerPerson(t);
    expect(await accountsOf(person.email)).toEqual([]);
  });

  it('IDN-05 un código correcto 16 minutos después responde 422 con 0 intentos', async () => {
    const { person, code } = await registerPerson(t);
    t.clock.advance(16 * 60_000);
    const res = await verify(person.email, code);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'VERIFICATION_CODE_INVALID', attemptsRemaining: 0 });
  });

  it('AUD-01 audita la verificación y los intentos fallidos con su propósito', async () => {
    const { person, code } = await registerPerson(t);
    await verify(person.email, wrongCode(code));
    await verify(person.email, code);
    const user = await userByEmail(person.email);
    const events = await auditEvents(harness.migrator);
    expect(events.map((event) => event.action)).toEqual([
      'USER_REGISTERED',
      'OTP_ATTEMPT_FAILED',
      'EMAIL_VERIFIED',
    ]);
    expect(events[1]).toMatchObject({ metadata: { purpose: 'EMAIL_VERIFICATION' } });
    expect(events[2]).toMatchObject({ actor_type: 'USER', actor_user_id: user.id });
  });

  it('AUD-03 si falla la escritura de EMAIL_VERIFIED, el usuario sigue sin verificar y sin cuentas', async () => {
    const real = new PgAuditWriter(harness.app, t.clock);
    const failing: AuditWriter = {
      record: async (tx, event) => {
        if (event.action === 'EMAIL_VERIFIED') throw new Error('falla forzada de auditoría');
        return real.record(tx, event);
      },
      recordStandalone: (event) => real.recordStandalone(event),
    };
    t = await buildTestApp(harness, { overrides: { audit: failing } });
    const { person, code } = await registerPerson(t);
    const res = await verify(person.email, code);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect((await userByEmail(person.email)).email_verified_at).toBeNull();
    expect(await accountsOf(person.email)).toEqual([]);
    const sessions = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.refresh_tokens',
    );
    expect(sessions[0].n).toBe(0);
  });
});
