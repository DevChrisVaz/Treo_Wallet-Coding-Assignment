import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { AUDIT_ACTIONS } from '../../../src/modules/audit/domain/audit-event.js';
import { testDb } from '../../helpers/env.js';
import { connect, sqlState } from '../../helpers/pg.js';

describe('AUD-01 tabla de auditoría', () => {
  let app: pg.Client;

  beforeAll(async () => {
    app = await connect(testDb.appUrl);
  });

  afterAll(() => app.end());

  it('AUD-01 el rol de ejecución inserta un evento completo sin RETURNING', async () => {
    await app.query(
      `INSERT INTO audit_log (actor_type, actor_user_id, action, entity_type, entity_id,
                              request_id, ip, user_agent, metadata)
       VALUES ('USER', gen_random_uuid(), 'LOGIN_SUCCEEDED', 'user', 'u-1', 'req-1',
               '203.0.113.7', 'vitest', '{"reason": null}')`,
    );
  });

  it('AUD-01 rechaza una acción fuera del catálogo por ck_audit_log_action', async () => {
    const error = await app
      .query(`INSERT INTO audit_log (actor_type, action) VALUES ('SYSTEM', 'MONEY_PRINTED')`)
      .catch((e: { code: string; constraint: string }) => e);
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_audit_log_action' });
  });

  it('AUD-01 rechaza un tipo de actor desconocido por ck_audit_log_actor_type', async () => {
    const error = await app
      .query(`INSERT INTO audit_log (actor_type, action) VALUES ('ROBOT', 'LOGOUT')`)
      .catch((e: { code: string; constraint: string }) => e);
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_audit_log_actor_type' });
  });

  it('AUD-01 el catálogo de la base coincide con el del dominio', async () => {
    const { rows } = await app.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conname = 'ck_audit_log_action'`,
    );
    const values = [...(rows[0]?.definition ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(values.sort()).toEqual([...AUDIT_ACTIONS].sort());
  });

  it.each([['[]'], ['"texto"'], ['42'], ['null'], ['true']])(
    'AUD-04 rechaza metadata %s que no es un objeto JSON por ck_audit_log_metadata_object',
    async (metadata) => {
      const error = await app
        .query(
          `INSERT INTO audit_log (actor_type, action, metadata) VALUES ('SYSTEM', 'LOGOUT', $1::jsonb)`,
          [metadata],
        )
        .catch((e: { code: string; constraint: string }) => e);
      expect(error).toMatchObject({ code: '23514', constraint: 'ck_audit_log_metadata_object' });
    },
  );

  it.each([['{}'], ['{"a": {"b": [1, 2]}}']])(
    'AUD-04 acepta metadata objeto %s',
    async (metadata) => {
      await app.query(
        `INSERT INTO audit_log (actor_type, action, metadata) VALUES ('SYSTEM', 'LOGOUT', $1::jsonb)`,
        [metadata],
      );
    },
  );

  it('AUD-06 la bitácora no tiene llaves foráneas', async () => {
    const { rows } = await app.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'app.audit_log'::regclass AND contype = 'f'`,
    );
    expect(rows).toEqual([]);
  });

  it('AUD-06 registra eventos de sujetos que no existen, como un login anónimo', async () => {
    await app.query(
      `INSERT INTO audit_log (actor_type, action, metadata)
       VALUES ('ANONYMOUS', 'LOGIN_FAILED', '{"reason": "UNKNOWN_EMAIL"}')`,
    );
  });

  it('AUD-04 el rol de ejecución no puede crear la función ni el trigger por su cuenta', async () => {
    expect(
      await sqlState(
        app.query('CREATE FUNCTION app.x() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'),
      ),
    ).toBe('42501');
  });
});
