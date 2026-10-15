import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRepository } from '../../../src/modules/identity/application/users.js';
import { PgUserRepository } from '../../../src/modules/identity/infrastructure/pg-user-repository.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { curpCheckDigit } from '../../../src/modules/identity/domain/curp.js';
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

/** Mismo CURP salvo el diferenciador (carácter 17), con su dígito verificador: comparte los 10 primeros. */
function siblingCurp(curp: string): string {
  const first16 = curp.slice(0, 16);
  const differentiator = curp[16] === '7' ? '8' : '7';
  return `${first16}${differentiator}${curpCheckDigit(`${first16}${differentiator}`)}`;
}

/** Datos de otra persona que repiten un solo dato único de `existing` y siguen siendo coherentes (RFC y CURP). */
function sharing(field: 'curp' | 'rfc' | 'phone', existing: Registration) {
  if (field === 'curp') return { curp: existing.curp, rfc: `${existing.rfc.slice(0, 10)}XY1` };
  if (field === 'rfc') return { rfc: existing.rfc, curp: siblingCurp(existing.curp) };
  return { phone: existing.phone };
}

/** CURP y RFC coherentes de alguien nacido en 20`yymmdd` (hoy del arnés: 13-oct-2026 en CDMX). */
function bornOn(yymmdd: string) {
  const first17 = `GOMC${yymmdd}HDFNLRA`;
  return { curp: `${first17}${curpCheckDigit(first17)}`, rfc: `GOMC${yymmdd}AB1` };
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

  it('IDN-05 al registrar de nuevo un email sin verificar, el código anterior deja de servir y el nuevo sí', async () => {
    const person = newRegistration();
    await register(person);
    const first = t.mailer.lastCode(person.email);

    await register(person);
    const second = t.mailer.lastCode(person.email);
    expect(t.mailer.to(person.email)).toHaveLength(2);

    // Con 1 de cada millón de sorteos el código nuevo coincide con el anterior; ahí no hay qué probar.
    if (second !== first) {
      const stale = await request(t.app)
        .post('/auth/verify-email')
        .send({ email: person.email, code: first });
      expect(stale.status).toBe(422);
      expect(stale.body.code).toBe('VERIFICATION_CODE_INVALID');
    }
    // El intento fallido no gastó el desafío: el código del segundo correo todavía verifica.
    const fresh = await request(t.app)
      .post('/auth/verify-email')
      .send({ email: person.email, code: second });
    expect(fresh.status).toBe(200);
    const [user] = await usersWith('email', person.email);
    expect(user.email_verified_at).not.toBeNull();
  });

  it('IDN-07 registrar un email sin verificar agotados los reenvíos no envía correo ni audita', async () => {
    const person = newRegistration();
    const created = await register(person);
    // Cada registro repetido es un reenvío: quedan 2, 1 y 0.
    for (const resendsRemaining of [2, 1, 0]) {
      expect((await register(person)).status).toBe(202);
      const resent = (await auditEvents(harness.migrator)).at(-1);
      expect(resent).toMatchObject({
        action: 'EMAIL_VERIFICATION_RESENT',
        actor_type: 'ANONYMOUS',
        metadata: { trigger: 'REGISTER', resendsRemaining },
      });
    }
    expect(t.mailer.to(person.email)).toHaveLength(4);
    const eventsBefore = (await auditEvents(harness.migrator)).length;

    const exhausted = await register(person);
    expect(exhausted.status).toBe(202);
    expect(exhausted.body).toEqual(created.body);
    expect(t.mailer.to(person.email)).toHaveLength(4);
    expect(await auditEvents(harness.migrator)).toHaveLength(eventsBefore);
    const [{ resend_count }] = await harness.migrator.query(
      `SELECT resend_count FROM app.one_time_codes`,
    );
    expect(resend_count).toBe(3);
  });

  it('IDN-01 dos registros simultáneos con el mismo email nuevo dejan un solo usuario', async () => {
    // Barrera: los dos ven que el email no existe antes de que alguno inserte; el que pierde recibe
    // el choque de uq_users_email y su reintento cae en la rama del email sin verificar.
    const real = new PgUserRepository(harness.app);
    let arrived = 0;
    let release!: () => void;
    const bothLooked = new Promise<void>((resolve) => (release = resolve));
    const users: UserRepository = Object.assign(Object.create(real) as UserRepository, {
      findByEmailForUpdate: async (...args: Parameters<UserRepository['findByEmailForUpdate']>) => {
        const found = await real.findByEmailForUpdate(...args);
        arrived += 1;
        if (arrived === 2) release();
        // Solo las dos primeras consultas esperan; la del reintento pasa de largo.
        if (arrived <= 2) await bothLooked;
        return found;
      },
    });
    t = await buildTestApp(harness, { overrides: { users } });

    const first = newRegistration();
    const second = newRegistration({ email: first.email });
    const responses = await Promise.all([register(first), register(second)]);
    expect(responses.map((res) => res.status)).toEqual([202, 202]);
    expect(responses[1]?.body).toEqual(responses[0]?.body);
    expect(arrived).toBe(3);

    expect(await usersWith('email', first.email)).toHaveLength(1);
    const [{ users: total }] = await harness.migrator.query(
      `SELECT count(*)::int AS users FROM app.users`,
    );
    expect(total).toBe(1);
    // Un código del alta y otro del reenvío: solo el último verifica.
    expect(t.mailer.to(first.email)).toHaveLength(2);
    const actions = (await auditEvents(harness.migrator)).map((event) => event.action).sort();
    expect(actions).toEqual(['EMAIL_VERIFICATION_RESENT', 'USER_REGISTERED']);
    const verified = await request(t.app)
      .post('/auth/verify-email')
      .send({ email: first.email, code: t.mailer.lastCode(first.email) });
    expect(verified.status).toBe(200);
  });

  it('IDN-01 todas las ramas responden exactamente el mismo cuerpo', async () => {
    const person = newRegistration();
    const created = await register(person);
    const unverified = await register(person);
    expect(unverified.body).toEqual(created.body);
  });
});

describe('IDN-02 datos obligatorios del registro', () => {
  it.each([
    ['CURP con dígito verificador incorrecto', { curp: 'GOMC900101HDFNLR08' }, '/curp'],
    ['RFC con fecha 990231', { rfc: 'GOMC990231AB1' }, '/rfc'],
    ['contraseña de 11 caracteres', { password: 'a'.repeat(11) }, '/password'],
    ['contraseña de 129 caracteres', { password: 'a1'.repeat(64) + 'b' }, '/password'],
    ['contraseña sin dígito', { password: 'solo letras largas' }, '/password'],
    ['contraseña sin letra', { password: '123456789012345' }, '/password'],
    ['nombre con dígitos', { fullName: 'Ana 2 Gómez' }, '/fullName'],
    ['nombre con símbolos', { fullName: 'Ana @ Gómez' }, '/fullName'],
    ['nombre de una sola palabra', { fullName: 'Ana' }, '/fullName'],
    ['nombre con espacios repetidos', { fullName: 'Ana  Gómez' }, '/fullName'],
    ['teléfono que empieza con 0', { phone: '0512345678' }, '/phone'],
    ['teléfono que empieza con 1', { phone: '1512345678' }, '/phone'],
    ['teléfono de 9 dígitos', { phone: '551234567' }, '/phone'],
    ['RFC que no coincide con la CURP', { rfc: 'PEPE700101AB1' }, '/rfc'],
  ])('IDN-02 %s responde 422 VALIDATION_FAILED en el campo', async (_case, change, pointer) => {
    const res = await register({ ...newRegistration(), ...change });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((error: { pointer: string }) => error.pointer)).toEqual([pointer]);
  });

  it('IDN-02 un RFC distinto al de la CURP dice "El RFC no coincide con tu CURP" con INVALID_FORMAT', async () => {
    const res = await register({ ...newRegistration(), rfc: 'PEPE700101AB1' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { pointer: '/rfc', code: 'INVALID_FORMAT', message: 'El RFC no coincide con tu CURP' },
    ]);
  });

  it('IDN-02 quien cumple 18 mañana (en CDMX) se rechaza con DATE_OUT_OF_RANGE en /curp y no se guarda', async () => {
    const person = newRegistration(bornOn('081014')); // cumple 18 el 14-oct-2026; hoy es el 13
    const res = await register(person);
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ pointer: '/curp', code: 'DATE_OUT_OF_RANGE' }),
    ]);
    expect(await usersWith('email', person.email)).toEqual([]);
  });

  it('IDN-02 quien cumple 18 hoy se registra', async () => {
    const person = newRegistration(bornOn('081013'));
    expect((await register(person)).status).toBe(202);
    expect(await usersWith('email', person.email)).toHaveLength(1);
  });

  it('IDN-02 una CURP con fecha de nacimiento futura se rechaza con INVALID_DATE en /curp', async () => {
    const res = await register(newRegistration(bornOn('301013')));
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ pointer: '/curp', code: 'INVALID_DATE' }),
    ]);
  });

  it('IDN-02 la mayoría de edad se mide con el Clock inyectado: un día después el mismo CURP es válido', async () => {
    t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
    const person = newRegistration(bornOn('081014'));
    expect((await register(person)).status).toBe(202);
  });

  it('IDN-02 datos válidos con nombre acentuado, ñ, apóstrofo y guion se registran', async () => {
    const person = newRegistration({ fullName: "María-José O'Brien Ñuñez" });
    expect((await register(person)).status).toBe(202);
    const [user] = await usersWith('email', person.email);
    expect(user.full_name).toBe("María-José O'Brien Ñuñez");
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
  const taken = {
    curp: {
      pointer: '/curp',
      code: 'ALREADY_REGISTERED',
      message: 'Esta CURP ya está registrada en otra cuenta.',
    },
    rfc: {
      pointer: '/rfc',
      code: 'ALREADY_REGISTERED',
      message: 'Este RFC ya está registrado en otra cuenta.',
    },
    phone: {
      pointer: '/phone',
      code: 'ALREADY_REGISTERED',
      message: 'Este teléfono ya está registrado en otra cuenta.',
    },
  };

  it.each(['curp', 'rfc', 'phone'] as const)(
    'IDN-03 un email nuevo con el %s de otro usuario se rechaza con 422, sin crear nada ni enviar correo',
    async (field) => {
      const existing = newRegistration();
      await register(existing);
      const intruder = newRegistration(sharing(field, existing));
      const res = await register(intruder);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors).toEqual([taken[field]]);
      expect(await usersWith('email', intruder.email)).toEqual([]);
      expect(t.mailer.to(intruder.email)).toEqual([]);
    },
  );

  it('IDN-03 si chocan varios datos, informa todos en el orden curp, rfc, phone', async () => {
    const existing = newRegistration();
    await register(existing);
    const intruder = newRegistration({
      ...sharing('curp', existing),
      ...sharing('phone', existing),
    });
    const res = await register(intruder);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([taken.curp, taken.phone]);
    expect(await usersWith('email', intruder.email)).toEqual([]);
    expect(t.mailer.to(intruder.email)).toEqual([]);
  });

  it('IDN-03 un email verificado sigue ganando: 202 y aviso aunque los datos choquen con otro usuario', async () => {
    const owner = newRegistration();
    await register(owner);
    const other = newRegistration();
    await register(other);
    await harness.migrator.query(
      `UPDATE app.users SET email_verified_at = now() WHERE email = $1`,
      [owner.email],
    );
    t.mailer.clear();
    const res = await register({ ...owner, ...sharing('phone', other) });
    expect(res.status).toBe(202);
    expect(t.mailer.to(owner.email).map((mail) => mail.subject)).toEqual([
      'Alguien intentó registrarse con tu correo',
    ]);
  });

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
    const second = newRegistration(sharing('rfc', first));
    const responses = await Promise.all([register(first), register(second)]);
    expect(arrived).toBe(2);
    expect(responses.map((res) => res.status).sort()).toEqual([202, 422]);
    const rejected = responses.find((res) => res.status === 422);
    expect(rejected?.body.code).toBe('VALIDATION_FAILED');
    expect(rejected?.body.errors).toEqual([taken.rfc]);
    expect(await usersWith('rfc', first.rfc)).toHaveLength(1);
    const created = [first, second].filter((p: Registration) => t.mailer.to(p.email).length > 0);
    expect(created).toHaveLength(1);
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
