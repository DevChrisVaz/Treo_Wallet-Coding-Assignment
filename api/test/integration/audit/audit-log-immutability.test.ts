import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from '../../helpers/env.js';
import { connect, sqlState } from '../../helpers/pg.js';

let app: pg.Client;
let owner: pg.Client;

beforeAll(async () => {
  app = await connect(testDb.appUrl);
  owner = await connect(testDb.migratorUrl);
  // Un evento existente, para que los triggers por fila tengan sobre qué dispararse.
  await owner.query(
    `INSERT INTO app.audit_log (actor_type, action) VALUES ('SYSTEM', 'FUNDING_POSTED')`,
  );
});

afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('AUD-04 inmutabilidad por permisos', () => {
  it('AUD-04 el rol de ejecución no puede leer la bitácora', async () => {
    expect(await sqlState(app.query('SELECT * FROM audit_log'))).toBe('42501');
  });

  it('AUD-04 el rol de ejecución no puede actualizar, borrar ni truncar la bitácora', async () => {
    expect(await sqlState(app.query(`UPDATE audit_log SET action = 'LOGOUT'`))).toBe('42501');
    expect(await sqlState(app.query('DELETE FROM audit_log'))).toBe('42501');
    expect(await sqlState(app.query('TRUNCATE audit_log'))).toBe('42501');
  });
});

describe('AUD-05 inmutabilidad de respaldo ante el dueño del esquema', () => {
  it('AUD-05 el dueño no puede actualizar un evento', async () => {
    await expect(owner.query(`UPDATE app.audit_log SET action = 'LOGOUT'`)).rejects.toThrow(
      /solo inserción/,
    );
  });

  it('AUD-05 el dueño no puede borrar un evento', async () => {
    await expect(owner.query('DELETE FROM app.audit_log')).rejects.toThrow(/solo inserción/);
  });

  it('AUD-05 el dueño no puede truncar la bitácora', async () => {
    await expect(owner.query('TRUNCATE app.audit_log')).rejects.toThrow(/solo inserción/);
  });
});
