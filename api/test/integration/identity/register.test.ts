import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRepository } from '../../../src/modules/identity/application/users.js';
import { PgUserRepository } from '../../../src/modules/identity/infrastructure/pg-user-repository.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { newRegistration, type Registration } from '../../helpers/factories.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

async function register(body: Record<string, unknown>) {
  const res = await request(t.app).post('/auth/register').send(body);
  expectToMatchContract(res, 'registerUser');
  return res;
}

async function usersWith(field: 'email' | 'curp' | 'rfc' | 'phone', value: string) {
  return harness.migrator.query(
    `SELECT id, email, full_name, curp, rfc, phone, password_hash, email_verified_at
       FROM app.users WHERE ${field} = $1`,
    [value],
  );
}

async function markVerified(email: string) {
  await harness.migrator.query(`UPDATE app.users SET email_verified_at = now() WHERE email = $1`, [
    email,
  ]);
}

describe('IDN-01 registro con respuesta uniforme', () => {
  it('IDN-01 un email nuevo crea un usuario sin verificar y le envía un código de 6 dígitos', async () => {
    const person = newRegistration();
    const res = await register(person);
    expect(res.status).toBe(202);
    const [user] = await usersWith('email', person.email);
    expect(user).toMatchObject({ full_name: person.fullName, email_verified_at: null });
    const mails = t.mailer.to(person.email);
    expect(mails).toHaveLength(1);
    expect(t.mailer.lastCode(person.email)).toMatch(/^[0-9]{6}$/);
  });

  it('IDN-01 un email ya verificado recibe un aviso, sin crear ni modificar nada', async () => {
    const person = newRegistration();
    const first = await register(person);
    await markVerified(person.email);
    const [before] = await usersWith('email', person.email);
    t.mailer.clear();

    const again = await register({ ...newRegistration(), email: person.email });
    expect(again.status).toBe(202);
    expect(again.body).toEqual(first.body);
    expect(await usersWith('email', person.email)).toEqual([before]);
    const [notice] = t.mailer.to(person.email);
    expect(notice?.subject).toMatch(/intentó registrarse/);
    expect(notice?.text).not.toMatch(/\b[0-9]{6}\b/);
  });

  it('IDN-01 un email sin verificar conserva sus datos y recibe un código nuevo', async () => {
    const person = newRegistration();
    await register(person);
    const [before] = await usersWith('email', person.email);
    const other = newRegistration({ email: person.email, fullName: 'Otro Nombre' });

    const res = await register(other);
    expect(res.status).toBe(202);
    expect(await usersWith('email', person.email)).toEqual([before]);
    expect(t.mailer.to(person.email)).toHaveLength(2);
    const [code] = await harness.migrator.query(
      `SELECT resend_count FROM app.one_time_codes WHERE subject_id = $1`,
      [before.id],
    );
    expect(code.resend_count).toBe(1);
  });

  it('IDN-01 todas las ramas responden exactamente el mismo cuerpo', async () => {
    const person = newRegistration();
    const created = await register(person);
    const unverified = await register(person);
    const conflict = await register({ ...newRegistration(), curp: person.curp });
    expect(unverified.body).toEqual(created.body);
    expect(conflict.body).toEqual(created.body);
  });
});

describe('IDN-02 datos obligatorios del registro', () => {
  it.each([
    ['CURP con dígito verificador incorrecto', { curp: 'GOMC900101HDFNLR08' }, '/curp'],
    ['RFC con fecha 990231', { rfc: 'GOMC990231AB1' }, '/rfc'],
    ['contraseña de 11 caracteres', { password: 'a'.repeat(11) }, '/password'],
    ['contraseña de 129 caracteres', { password: 'a'.repeat(129) }, '/password'],
  ])('IDN-02 %s responde 422 VALIDATION_FAILED en el campo', async (_case, change, pointer) => {
    const res = await register({ ...newRegistration(), ...change });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((error: { pointer: string }) => error.pointer)).toEqual([pointer]);
  });

  it('IDN-02 guarda el email normalizado y el teléfono en E.164', async () => {
    const person = newRegistration();
    const res = await register({ ...person, email: `  ${person.email.toUpperCase()} ` });
    expect(res.status).toBe(202);
    const [user] = await usersWith('email', person.email);
    expect(user.phone).toBe(`+52${person.phone}`);
  });
});

describe('IDN-03 unicidad de los datos de identidad', () => {
  it.each(['curp', 'rfc', 'phone'] as const)(
    'IDN-03 un email nuevo con el %s de otro usuario no se crea y recibe un aviso genérico',
    async (field) => {
      const existing = newRegistration();
      await register(existing);
      const intruder = newRegistration({ [field]: existing[field] });
      const res = await register(intruder);
      expect(res.status).toBe(202);
      expect(await usersWith('email', intruder.email)).toEqual([]);
      const [notice] = t.mailer.to(intruder.email);
      expect(notice?.subject).toBe('No pudimos completar tu registro');
      expect(`${notice?.subject} ${notice?.text}`).not.toMatch(/CURP|RFC|tel[eé]fono/i);
    },
  );

  it('IDN-03 dos registros simultáneos con el mismo RFC crean a lo sumo un usuario', async () => {
    // Barrera: ninguno sigue después del pre-chequeo hasta que ambos lo pasaron, así los dos
    // intentan el INSERT y la constraint única de la base es la que decide.
    const real = new PgUserRepository(harness.app);
    let arrived = 0;
    let release!: () => void;
    const bothChecked = new Promise<void>((resolve) => (release = resolve));
    const users: UserRepository = Object.assign(Object.create(real) as UserRepository, {
      identityInUse: async (...args: Parameters<UserRepository['identityInUse']>) => {
        const inUse = await real.identityInUse(...args);
        arrived += 1;
        if (arrived === 2) release();
        await bothChecked;
        return inUse;
      },
    });
    t = await buildTestApp(harness, { overrides: { users } });

    const first = newRegistration();
    const second = newRegistration({ rfc: first.rfc });
    const responses = await Promise.all([register(first), register(second)]);
    expect(arrived).toBe(2);
    expect(responses.map((res) => res.status)).toEqual([202, 202]);
    expect(await usersWith('rfc', first.rfc)).toHaveLength(1);
    const notified = [first, second].filter((p: Registration) =>
      t.mailer.to(p.email).some((mail) => mail.subject === 'No pudimos completar tu registro'),
    );
    expect(notified).toHaveLength(1);
  });
});

describe('IDN-04 contraseñas', () => {
  it('IDN-04 la base guarda un hash argon2id y no la contraseña en claro', async () => {
    const person = newRegistration();
    await register(person);
    const [user] = await usersWith('email', person.email);
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    const [{ found }] = await harness.migrator.query(
      `SELECT count(*)::int AS found FROM app.users WHERE password_hash LIKE '%' || $1 || '%'`,
      [person.password],
    );
    expect(found).toBe(0);
  });
});

describe('PLT-16 correo después del COMMIT', () => {
  it('PLT-16 con el servidor de correo caído responde 202 y el usuario queda sin verificar', async () => {
    const person = newRegistration();
    t.mailer.down = true;
    const res = await register(person);
    expect(res.status).toBe(202);
    expect(await usersWith('email', person.email)).toMatchObject([{ email_verified_at: null }]);
    expect(t.logs.text()).toContain('mail delivery failed');
  });
});

describe('AUD-02 y PLT-06 datos personales fuera de auditoría y logs', () => {
  it('AUD-01 el registro deja USER_REGISTERED con el id del usuario y sin datos personales', async () => {
    const person = newRegistration();
    await register(person);
    const [user] = await usersWith('email', person.email);
    const events = await auditEvents(harness.migrator);
    expect(events).toMatchObject([{ action: 'USER_REGISTERED', entity_id: user.id }]);
    expect(
      leakedValues(events, [person.email, person.curp, person.rfc, person.phone, person.password]),
    ).toEqual([]);
  });

  it('PLT-06 ninguna línea de log de la petición contiene los datos en claro', async () => {
    const person = newRegistration();
    t.mailer.down = true;
    await register(person);
    const output = t.logs.text();
    for (const value of [person.email, person.curp, person.rfc, person.phone, person.password]) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain('request completed');
  });
});
