import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../helpers/env.js';
import { connect } from '../../helpers/pg.js';

let app: pg.Client;
let owner: pg.Client;
const run = randomUUID().slice(0, 8).toUpperCase();
let seq = 0;

/** Datos de usuario únicos para esta corrida (la base no valida el formato de CURP ni RFC). */
function userValues(overrides: Partial<Record<string, string | null>> = {}) {
  seq += 1;
  const n = String(seq).padStart(2, '0');
  return {
    id: randomUUID(),
    email: `user-${run.toLowerCase()}-${n}@example.com`,
    full_name: 'Ana Gómez',
    first_names: 'Ana',
    paternal_surname: 'Gómez',
    maternal_surname: null as string | null,
    birth_date: '1990-01-01',
    birth_state: 'DF',
    curp: `C${run}${n}`.padEnd(18, 'X'),
    rfc: `R${run}${n}`.padEnd(13, 'X'),
    phone: `+5255${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
    ...overrides,
  };
}

async function insertUser(
  values: ReturnType<typeof userValues>,
  { inReview = false }: { inReview?: boolean } = {},
) {
  await app.query(
    `INSERT INTO users (id, email, password_hash, full_name, curp, rfc, phone,
                        first_names, paternal_surname, maternal_surname, birth_date, birth_state,
                        identity_conflict)
     VALUES ($1, $2, 'argon2-hash', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      values.id,
      values.email,
      values.full_name,
      values.curp,
      values.rfc,
      values.phone,
      values.first_names,
      values.paternal_surname,
      values.maternal_surname,
      values.birth_date,
      values.birth_state,
      inReview,
    ],
  );
}

async function constraintOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = (await promise.then(
    () => undefined,
    (e: unknown) => e,
  )) as { constraint?: string } | undefined;
  return error?.constraint;
}

beforeAll(async () => {
  app = await connect(testDb.appUrl);
  owner = await connect(testDb.migratorUrl);
});

afterAll(async () => {
  await owner.query(`DELETE FROM app.users WHERE email LIKE $1`, [`user-${run.toLowerCase()}-%`]);
  await app.end();
  await owner.end();
});

describe('IDN-03 unicidad de los datos de identidad en la base', () => {
  it('IDN-03 inserta un usuario con datos únicos', async () => {
    await insertUser(userValues());
  });

  it('IDN-03 rechaza un email repetido con uq_users_email', async () => {
    const first = userValues();
    await insertUser(first);
    expect(await constraintOf(insertUser(userValues({ email: first.email })))).toBe(
      'uq_users_email',
    );
  });

  it('IDN-03 el email solo se guarda normalizado, así que la unicidad ignora mayúsculas', async () => {
    const values = userValues();
    expect(await constraintOf(insertUser({ ...values, email: values.email.toUpperCase() }))).toBe(
      'ck_users_email_normalized',
    );
    expect(await constraintOf(insertUser({ ...values, email: ` ${values.email}` }))).toBe(
      'ck_users_email_normalized',
    );
  });

  it('IDN-03 rechaza CURP, RFC o teléfono repetidos con su constraint', async () => {
    const first = userValues();
    await insertUser(first);
    expect(await constraintOf(insertUser(userValues({ curp: first.curp })))).toBe('uq_users_curp');
    expect(await constraintOf(insertUser(userValues({ rfc: first.rfc })))).toBe('uq_users_rfc');
    expect(await constraintOf(insertUser(userValues({ phone: first.phone })))).toBe(
      'uq_users_phone',
    );
  });

  it('IDN-03 un usuario en revisión puede repetir la CURP, el RFC y el teléfono de otro', async () => {
    const first = userValues();
    await insertUser(first);
    await insertUser(userValues({ curp: first.curp, rfc: first.rfc, phone: first.phone }), {
      inReview: true,
    });
  });

  it('IDN-03 un usuario en revisión no libera los datos para otro usuario activo', async () => {
    const first = userValues();
    await insertUser(first);
    await insertUser(userValues({ curp: first.curp }), { inReview: true });
    expect(await constraintOf(insertUser(userValues({ curp: first.curp })))).toBe('uq_users_curp');
  });

  it('IDN-03 el email es único también para los usuarios en revisión', async () => {
    const first = userValues();
    await insertUser(first);
    expect(
      await constraintOf(insertUser(userValues({ email: first.email }), { inReview: true })),
    ).toBe('uq_users_email');
  });

  it('IDN-02 exige un nombre completo de 1 a 100 caracteres', async () => {
    expect(await constraintOf(insertUser(userValues({ full_name: '' })))).toBe(
      'ck_users_full_name_length',
    );
    expect(await constraintOf(insertUser(userValues({ full_name: 'Ñ'.repeat(101) })))).toBe(
      'ck_users_full_name_length',
    );
    await insertUser(userValues({ full_name: 'Ñ'.repeat(100) }));
  });

  it('IDN-02 exige nombres y apellido paterno de 1 a 100 caracteres y un materno vacío es NULL', async () => {
    expect(await constraintOf(insertUser(userValues({ first_names: '' })))).toBe(
      'ck_users_first_names_length',
    );
    expect(await constraintOf(insertUser(userValues({ paternal_surname: 'Ñ'.repeat(101) })))).toBe(
      'ck_users_paternal_surname_length',
    );
    expect(await constraintOf(insertUser(userValues({ maternal_surname: '' })))).toBe(
      'ck_users_maternal_surname_length',
    );
    await insertUser(userValues({ maternal_surname: null }));
  });

  it('IDN-02 solo admite como entidad de nacimiento un código del catálogo, incluido NE', async () => {
    expect(await constraintOf(insertUser(userValues({ birth_state: 'XX' })))).toBe(
      'ck_users_birth_state',
    );
    expect(await constraintOf(insertUser(userValues({ birth_state: 'df' })))).toBe(
      'ck_users_birth_state',
    );
    await insertUser(userValues({ birth_state: 'NE' }));
  });

  it('IDN-02 guarda el teléfono solo en formato E.164 de México', async () => {
    expect(await constraintOf(insertUser(userValues({ phone: '5512345678' })))).toBe(
      'ck_users_phone_e164',
    );
  });

  it('PLT-14 el rol de ejecución tiene SELECT, INSERT y UPDATE, pero no DELETE ni TRUNCATE', async () => {
    const { rows } = await app.query<Record<string, boolean>>(
      `SELECT has_table_privilege('wallet_app', 'app.users', 'SELECT') AS select,
              has_table_privilege('wallet_app', 'app.users', 'INSERT') AS insert,
              has_table_privilege('wallet_app', 'app.users', 'UPDATE') AS update,
              has_table_privilege('wallet_app', 'app.users', 'DELETE') AS delete,
              has_table_privilege('wallet_app', 'app.users', 'TRUNCATE') AS truncate`,
    );
    expect(rows[0]).toEqual({
      select: true,
      insert: true,
      update: true,
      delete: false,
      truncate: false,
    });
  });
});
