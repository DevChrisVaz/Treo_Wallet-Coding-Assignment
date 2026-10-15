import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../helpers/env.js';
import { connect, sqlState } from '../../helpers/pg.js';
import { clabeVectors } from '../../vectors/clabe.js';

let app: pg.Client;
let owner: pg.Client;
let userId: string;
const createdUsers: string[] = [];

async function newUser(): Promise<string> {
  const id = randomUUID();
  const tag = id.replace(/-/g, '').slice(0, 12).toUpperCase();
  await app.query(
    `INSERT INTO users (id, email, password_hash, full_name, curp, rfc, phone, first_names, paternal_surname, birth_date, birth_state)
     VALUES ($1, $2, 'hash', 'Prueba', $3, $4, $5, 'Ana', 'Gómez', '1990-01-01', 'DF')`,
    [
      id,
      `acc-${tag.toLowerCase()}@example.com`,
      `C${tag}`.padEnd(18, 'X'),
      `R${tag}`.slice(0, 13),
      `+52${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
    ],
  );
  createdUsers.push(id);
  return id;
}

/** CLABE válida de la plataforma de prueba: banco 999, plaza 180, cuenta aleatoria y su DV. */
function validClabe(): string {
  const first17 = `999180${String(Math.floor(Math.random() * 1e11)).padStart(11, '0')}`;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(first17[i]) * (weights[i % 3] ?? 0)) % 10;
  return `${first17}${(10 - (sum % 10)) % 10}`;
}

async function failure(promise: Promise<unknown>) {
  return (await promise.then(
    () => undefined,
    (e: unknown) => e,
  )) as { code?: string; constraint?: string } | undefined;
}

beforeAll(async () => {
  app = await connect(testDb.appUrl);
  owner = await connect(testDb.migratorUrl);
  userId = await newUser();
});

afterAll(async () => {
  await owner.query(`DELETE FROM app.accounts WHERE user_id = ANY($1)`, [createdUsers]);
  await owner.query(`DELETE FROM app.users WHERE id = ANY($1)`, [createdUsers]);
  await app.end();
  await owner.end();
});

describe('ACC-01 cuentas de usuario y cuenta de sistema', () => {
  it('ACC-01 las migraciones crean exactamente una Tesorería SYSTEM sin dueño ni CLABE', async () => {
    // Sin el saldo: este archivo no reinicia la base y otras pruebas fondean cuentas desde la
    // Tesorería, así que su saldo depende del orden en que corran los archivos.
    const { rows } = await app.query(
      `SELECT name, user_id, clabe FROM accounts WHERE type = 'SYSTEM'`,
    );
    expect(rows).toEqual([{ name: 'Tesorería', user_id: null, clabe: null }]);
  });

  it('ACC-01 no admite una segunda cuenta SYSTEM', async () => {
    const error = await failure(
      owner.query(`INSERT INTO app.accounts (id, type, name) VALUES ($1, 'SYSTEM', 'Otra')`, [
        randomUUID(),
      ]),
    );
    expect(error).toMatchObject({ code: '23505', constraint: 'uq_accounts_single_system' });
  });

  it('ACC-01 rechaza una cuenta USER sin dueño', async () => {
    const error = await failure(
      app.query(`INSERT INTO accounts (id, type, name, clabe) VALUES ($1, 'USER', 'X', $2)`, [
        randomUUID(),
        validClabe(),
      ]),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_owner_by_type' });
  });

  it('ACC-01 rechaza una cuenta SYSTEM con dueño', async () => {
    const error = await failure(
      owner.query(
        `INSERT INTO app.accounts (id, user_id, type, name) VALUES ($1, $2, 'SYSTEM', 'X')`,
        [randomUUID(), userId],
      ),
    );
    expect(error?.code).toBe('23514');
  });

  it('ACC-04 el nombre de la cuenta es único entre las cuentas de su dueño', async () => {
    const id = await newUser();
    await app.query(
      `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'Principal', $3)`,
      [randomUUID(), id, validClabe()],
    );
    const error = await failure(
      app.query(
        `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'Principal', $3)`,
        [randomUUID(), id, validClabe()],
      ),
    );
    expect(error).toMatchObject({ code: '23505', constraint: 'uq_accounts_user_name' });
  });
});

describe('ACC-02 saldo no negativo garantizado por la base', () => {
  it('ACC-02 rechaza dejar en -1 centavo una cuenta USER', async () => {
    const id = randomUUID();
    await app.query(
      `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'Ahorro', $3)`,
      [id, userId, validClabe()],
    );
    const error = await failure(
      app.query(`UPDATE accounts SET balance_cents = -1 WHERE id = $1`, [id]),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_balance_non_negative' });
  });

  it('ACC-02 acepta un saldo negativo en la Tesorería', async () => {
    await owner.query('BEGIN');
    try {
      await owner.query(`UPDATE app.accounts SET balance_cents = -500 WHERE type = 'SYSTEM'`);
    } finally {
      await owner.query('ROLLBACK');
    }
  });
});

describe('ACC-03 CLABE de las cuentas', () => {
  it('ACC-03 una cuenta USER no puede quedar sin CLABE', async () => {
    const error = await failure(
      app.query(`INSERT INTO accounts (id, user_id, type, name) VALUES ($1, $2, 'USER', 'Sin')`, [
        randomUUID(),
        userId,
      ]),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_clabe_by_type' });
  });

  it('ACC-03 la CLABE es única en todo el sistema', async () => {
    const clabe = validClabe();
    const other = await newUser();
    await app.query(
      `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'A', $3)`,
      [randomUUID(), other, clabe],
    );
    const error = await failure(
      app.query(
        `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'B', $3)`,
        [randomUUID(), other, clabe],
      ),
    );
    expect(error).toMatchObject({ code: '23505', constraint: 'uq_accounts_clabe' });
  });
});

describe('ACC-05 dígito verificador de la CLABE en la base', () => {
  it.each(clabeVectors)('ACC-05 clabe_is_valid($clabe) = $valid ($note)', async (vector) => {
    const { rows } = await app.query<{ valid: boolean }>('SELECT clabe_is_valid($1) AS valid', [
      vector.clabe,
    ]);
    expect(rows[0]?.valid).toBe(vector.valid);
  });

  it('ACC-05 rechaza guardar una CLABE con dígito verificador incorrecto', async () => {
    const error = await failure(
      app.query(
        `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'Mala', $3)`,
        [randomUUID(), userId, '032180000118359718'],
      ),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_clabe_valid' });
  });

  it('ACC-05 conserva los ceros a la izquierda de la CLABE', async () => {
    const id = randomUUID();
    const other = await newUser();
    await app.query(
      `INSERT INTO accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', 'Cero', $3)`,
      [id, other, '032180000118359719'],
    );
    const { rows } = await app.query<{ clabe: string }>(
      'SELECT clabe FROM accounts WHERE id = $1',
      [id],
    );
    expect(rows[0]?.clabe).toBe('032180000118359719');
    expect(rows[0]?.clabe).toHaveLength(18);
  });
});

/** Fila de cuenta USER válida; cada caso cambia un solo campo para que falle solo su constraint. */
function userAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    user_id: userId,
    type: 'USER',
    name: `Cuenta ${randomUUID().slice(0, 8)}`,
    clabe: validClabe(),
    ...overrides,
  };
}

async function insertAccount(db: pg.Client, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  await db.query(
    `INSERT INTO app.accounts (${columns.join(', ')})
     VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
}

describe('ACC-01 y ACC-03 constraints de la tabla accounts por inserción directa', () => {
  it('ACC-03 una cuenta SYSTEM no puede tener CLABE', async () => {
    const error = await failure(
      insertAccount(owner, {
        id: randomUUID(),
        type: 'SYSTEM',
        name: 'Con CLABE',
        clabe: validClabe(),
      }),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_clabe_by_type' });
  });

  it('ACC-01 el tipo de cuenta solo puede ser USER o SYSTEM', async () => {
    // Sin dueño ni CLABE para que las demás constraints de tipo no se disparen antes.
    const error = await failure(
      insertAccount(owner, { id: randomUUID(), type: 'ADMIN', name: 'Rara' }),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_type' });
  });

  it.each([
    ['vacío', ''],
    ['de 51 caracteres', 'x'.repeat(51)],
  ])('ACC-01 rechaza un nombre %s por ck_accounts_name_length', async (_label, name) => {
    const error = await failure(insertAccount(app, userAccount({ name })));
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_accounts_name_length' });
  });

  it.each([
    ['de 1 caracter', 'x'],
    ['de 50 caracteres', 'y'.repeat(50)],
  ])('ACC-01 acepta un nombre %s', async (_label, name) => {
    await insertAccount(app, userAccount({ name }));
  });

  it('ACC-01 el dueño de la cuenta debe existir (fk_accounts_user)', async () => {
    const error = await failure(insertAccount(app, userAccount({ user_id: randomUUID() })));
    expect(error).toMatchObject({ code: '23503', constraint: 'fk_accounts_user' });
  });
});

describe('ACC-06 privilegios del rol de ejecución sobre accounts', () => {
  it('ACC-06 wallet_app puede actualizar balance_cents', async () => {
    const row = userAccount();
    await insertAccount(app, row);
    await app.query(`UPDATE accounts SET balance_cents = 100 WHERE id = $1`, [row.id]);
  });

  it.each([
    ['name', `'Otro'`],
    ['clabe', `'${'0'.repeat(18)}'`],
    ['type', `'SYSTEM'`],
    ['user_id', 'NULL'],
    ['created_at', 'now()'],
    ['id', 'gen_random_uuid()'],
  ])('ACC-06 wallet_app no puede actualizar la columna %s (42501)', async (column, value) => {
    const row = userAccount();
    await insertAccount(app, row);
    expect(
      await sqlState(app.query(`UPDATE accounts SET ${column} = ${value} WHERE id = $1`, [row.id])),
    ).toBe('42501');
  });

  it('ACC-06 wallet_app no puede borrar cuentas (42501)', async () => {
    const row = userAccount();
    await insertAccount(app, row);
    expect(await sqlState(app.query(`DELETE FROM accounts WHERE id = $1`, [row.id]))).toBe('42501');
  });
});
