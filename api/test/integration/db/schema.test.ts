import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { testDb } from '../../helpers/env.js';
import { sqlState, withClient } from '../../helpers/pg.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** La tabla de control de TypeORM no es parte del modelo: su PK la nombra la herramienta. */
const TOOL_TABLES = ['typeorm_migrations'];

function npmScript(script: string, ...args: string[]) {
  const result = spawnSync(
    'npm',
    ['run', '--silent', script, ...(args.length ? ['--', ...args] : [])],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MIGRATION_DATABASE_URL: testDb.migratorUrl },
      timeout: 120_000,
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** Constraints, índices y triggers del esquema app, para comparar antes y después. */
async function schemaSnapshot(): Promise<string[]> {
  return withClient(testDb.migratorUrl, async (client) => {
    const { rows } = await client.query<{ item: string }>(
      `SELECT 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) AS item
         FROM pg_constraint WHERE connamespace = 'app'::regnamespace
       UNION ALL
       SELECT 'index ' || indexname || ' ' || indexdef FROM pg_indexes WHERE schemaname = 'app'
       UNION ALL
       SELECT 'trigger ' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relnamespace = 'app'::regnamespace
       ORDER BY 1`,
    );
    return rows.map((row) => row.item);
  });
}

describe('PLT-04 nombres de constraints e índices', () => {
  it('PLT-04 todas las constraints, índices y triggers del esquema tienen prefijo permitido', async () => {
    await withClient(testDb.migratorUrl, async (client) => {
      const constraints = await client.query<{ name: string; kind: string; tbl: string }>(
        `SELECT conname AS name, contype AS kind, conrelid::regclass::text AS tbl
           FROM pg_constraint WHERE connamespace = 'app'::regnamespace`,
      );
      const expectedPrefix: Record<string, string> = { p: 'pk_', f: 'fk_', u: 'uq_', c: 'ck_' };
      const badConstraints = constraints.rows
        .filter((row) => !TOOL_TABLES.some((table) => row.tbl.endsWith(table)))
        .filter((row) => !row.name.startsWith(expectedPrefix[row.kind] ?? '?'));
      expect(badConstraints).toEqual([]);

      const indexes = await client.query<{ name: string; tbl: string }>(
        `SELECT indexname AS name, tablename AS tbl FROM pg_indexes WHERE schemaname = 'app'`,
      );
      const badIndexes = indexes.rows
        .filter((row) => !TOOL_TABLES.includes(row.tbl))
        .filter((row) => !/^(pk|uq|ix)_/.test(row.name));
      expect(badIndexes).toEqual([]);

      const triggers = await client.query<{ name: string }>(
        `SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
          WHERE NOT t.tgisinternal AND c.relnamespace = 'app'::regnamespace`,
      );
      expect(triggers.rows.length).toBeGreaterThanOrEqual(2);
      expect(triggers.rows.filter((row) => !row.name.startsWith('tg_'))).toEqual([]);
      expect(constraints.rows.length).toBeGreaterThan(10);
    });
  });
});

describe('PLT-14 privilegios del rol de ejecución', () => {
  it('PLT-14 ninguna tabla del esquema otorga DELETE ni TRUNCATE a wallet_app', async () => {
    await withClient(testDb.migratorUrl, async (client) => {
      const { rows } = await client.query<{ tbl: string; privilege: string }>(
        `SELECT c.relname AS tbl, p.privilege
           FROM pg_class c
           CROSS JOIN (VALUES ('DELETE'), ('TRUNCATE')) AS p(privilege)
          WHERE c.relnamespace = 'app'::regnamespace AND c.relkind IN ('r', 'p')
            AND has_table_privilege('wallet_app', c.oid, p.privilege)`,
      );
      expect(rows).toEqual([]);
    });
  });

  it('PLT-14 wallet_app no es dueño de ningún objeto del esquema', async () => {
    await withClient(testDb.migratorUrl, async (client) => {
      const { rows } = await client.query(
        `SELECT relname FROM pg_class
          WHERE relnamespace = 'app'::regnamespace AND pg_get_userbyid(relowner) = 'wallet_app'`,
      );
      expect(rows).toEqual([]);
    });
  });

  it('PLT-14 wallet_app no puede crear ni alterar tablas', async () => {
    await withClient(testDb.appUrl, async (client) => {
      expect(await sqlState(client.query('CREATE TABLE app.intruso (id int)'))).toBe('42501');
      expect(await sqlState(client.query('ALTER TABLE app.users ADD COLUMN x int'))).toBe('42501');
    });
  });
});

describe('PLT-15 migraciones reversibles', () => {
  it('PLT-15 migrar dos veces seguidas no aplica cambios la segunda vez', () => {
    const first = npmScript('db:migrate');
    expect(first.status, first.output).toBe(0);
    const second = npmScript('db:migrate');
    expect(second.status, second.output).toBe(0);
    expect(second.output).toContain('Sin migraciones pendientes');
  });

  it('PLT-15 ida, vuelta e ida terminan sin errores y dejan el mismo esquema', async () => {
    const before = await schemaSnapshot();
    const down = npmScript('db:revert', '--all');
    expect(down.status, down.output).toBe(0);
    await withClient(testDb.migratorUrl, async (client) => {
      const { rows } = await client.query(
        `SELECT relname FROM pg_class
          WHERE relnamespace = 'app'::regnamespace AND relkind = 'r' AND relname <> ALL($1)`,
        [TOOL_TABLES],
      );
      expect(rows).toEqual([]);
    });
    const up = npmScript('db:migrate');
    expect(up.status, up.output).toBe(0);
    expect(await schemaSnapshot()).toEqual(before);
  });
});
