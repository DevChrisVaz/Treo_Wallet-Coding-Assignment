import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../helpers/env.js';
import { connect } from '../../helpers/pg.js';

let app: pg.Client;
let owner: pg.Client;
let userId: string;

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

async function failure(promise: Promise<unknown>) {
  return (await promise.then(
    () => undefined,
    (e: unknown) => e,
  )) as { code?: string; constraint?: string } | undefined;
}

async function insertToken(values: { id?: string; familyId?: string; hash?: string } = {}) {
  const id = values.id ?? randomUUID();
  await app.query(
    `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, issued_at, expires_at,
                                 family_expires_at)
     VALUES ($1, $2, $3, $4, now(), now() + interval '7 days', now() + interval '30 days')`,
    [id, userId, values.familyId ?? randomUUID(), values.hash ?? sha(randomUUID())],
  );
  return id;
}

async function insertCode(values: Record<string, unknown> = {}) {
  await app.query(
    `INSERT INTO one_time_codes (id, purpose, subject_id, code_hash, attempts, resend_count,
                                 expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() + interval '15 minutes')`,
    [
      randomUUID(),
      values.purpose ?? 'EMAIL_VERIFICATION',
      values.subject ?? randomUUID(),
      sha(randomUUID()),
      values.attempts ?? 0,
      values.resends ?? 0,
    ],
  );
}

beforeAll(async () => {
  app = await connect(testDb.appUrl);
  owner = await connect(testDb.migratorUrl);
  userId = randomUUID();
  const tag = userId.replace(/-/g, '').slice(0, 12).toUpperCase();
  await app.query(
    `INSERT INTO users (id, email, password_hash, full_name, curp, rfc, phone)
     VALUES ($1, $2, 'hash', 'Prueba', $3, $4, $5)`,
    [
      userId,
      `tok-${tag.toLowerCase()}@example.com`,
      `T${tag}`.padEnd(18, 'X'),
      `T${tag}`.slice(0, 13),
      `+52${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
    ],
  );
});

afterAll(async () => {
  await owner.query(`DELETE FROM app.refresh_tokens WHERE user_id = $1`, [userId]);
  await owner.query(`DELETE FROM app.users WHERE id = $1`, [userId]);
  await app.end();
  await owner.end();
});

describe('IDN-11 tabla de refresh tokens', () => {
  it('IDN-11 el hash del token es único', async () => {
    const hash = sha(randomUUID());
    await insertToken({ hash });
    expect(await failure(insertToken({ hash }))).toMatchObject({
      code: '23505',
      constraint: 'uq_refresh_tokens_token_hash',
    });
  });

  it('IDN-11 solo guarda hashes SHA-256 en hexadecimal, nunca el token en claro', async () => {
    expect(await failure(insertToken({ hash: 'token-en-claro' }))).toMatchObject({
      code: '23514',
      constraint: 'ck_refresh_tokens_token_hash_hex',
    });
  });

  it('IDN-11 el sucesor debe ser un token existente', async () => {
    const id = await insertToken();
    const error = await failure(
      app.query('UPDATE refresh_tokens SET replaced_by = $1 WHERE id = $2', [randomUUID(), id]),
    );
    expect(error).toMatchObject({ code: '23503', constraint: 'fk_refresh_tokens_replaced_by' });
  });

  it('IDN-11 la revocación siempre lleva un motivo del catálogo', async () => {
    const id = await insertToken();
    expect(
      await failure(app.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [id])),
    ).toMatchObject({ code: '23514', constraint: 'ck_refresh_tokens_revocation' });
    expect(
      await failure(
        app.query(
          `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'PORQUE_SI' WHERE id = $1`,
          [id],
        ),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_refresh_tokens_revoked_reason' });
  });

  it('IDN-11 la familia tiene un índice para revocarla completa', async () => {
    const { rows } = await app.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'app' AND indexname = 'ix_refresh_tokens_family'`,
    );
    expect(rows[0]?.indexdef).toMatch(/\(family_id\)/);
  });
});

describe('IDN-05 tabla de códigos de un solo uso', () => {
  it('IDN-05 admite los propósitos de verificación de correo y de transferencia', async () => {
    await insertCode({ purpose: 'EMAIL_VERIFICATION' });
    await insertCode({ purpose: 'TRANSFER_CONFIRMATION' });
    expect(await failure(insertCode({ purpose: 'PASSWORD_RESET' }))).toMatchObject({
      code: '23514',
      constraint: 'ck_one_time_codes_purpose',
    });
  });

  it('IDN-05 un solo desafío por propósito y sujeto', async () => {
    const subject = randomUUID();
    await insertCode({ subject });
    expect(await failure(insertCode({ subject }))).toMatchObject({
      code: '23505',
      constraint: 'uq_one_time_codes_purpose_subject',
    });
  });

  it('IDN-05 a lo más 3 intentos y 3 reenvíos', async () => {
    await insertCode({ attempts: 3, resends: 3 });
    expect(await failure(insertCode({ attempts: 4 }))).toMatchObject({
      constraint: 'ck_one_time_codes_attempts',
    });
    expect(await failure(insertCode({ resends: 4 }))).toMatchObject({
      constraint: 'ck_one_time_codes_resend_count',
    });
  });
});

describe('PLT-14 privilegios de las tablas de sesión y códigos', () => {
  it.each(['refresh_tokens', 'one_time_codes'])(
    'PLT-14 %s: SELECT, INSERT y UPDATE sin DELETE ni TRUNCATE',
    async (table) => {
      const { rows } = await app.query<Record<string, boolean>>(
        `SELECT has_table_privilege('wallet_app', $1, 'SELECT') AS select,
                has_table_privilege('wallet_app', $1, 'INSERT') AS insert,
                has_table_privilege('wallet_app', $1, 'UPDATE') AS update,
                has_table_privilege('wallet_app', $1, 'DELETE') AS delete,
                has_table_privilege('wallet_app', $1, 'TRUNCATE') AS truncate`,
        [`app.${table}`],
      );
      expect(rows[0]).toEqual({
        select: true,
        insert: true,
        update: true,
        delete: false,
        truncate: false,
      });
    },
  );
});
