import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { testDb, withDatabase } from '../../helpers/env.js';
import { sqlState, withClient } from '../../helpers/pg.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function runBootstrap() {
  return spawnSync('npm', ['run', '--silent', 'db:bootstrap'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BOOTSTRAP_DATABASE_URL: testDb.bootstrapUrl },
    timeout: 60_000,
  });
}

describe('PLT-14 arranque de roles y bases', () => {
  it('PLT-14 db:bootstrap es idempotente', () => {
    const first = runBootstrap();
    expect(first.status, first.stderr).toBe(0);
    const second = runBootstrap();
    expect(second.status, second.stderr).toBe(0);
  });

  it('PLT-14 crea dos roles sin superpoderes: el dueño del esquema y el de ejecución', async () => {
    await withClient(testDb.bootstrapUrl, async (client) => {
      const { rows } = await client.query<{
        rolname: string;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolcanlogin: boolean;
        rolconfig: string[] | null;
      }>(
        `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolconfig
           FROM pg_roles WHERE rolname IN ('wallet_migrator', 'wallet_app') ORDER BY rolname`,
      );
      expect(rows.map((row) => row.rolname)).toEqual(['wallet_app', 'wallet_migrator']);
      for (const row of rows) {
        expect(row).toMatchObject({
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolcanlogin: true,
        });
        expect(row.rolconfig).toContain('search_path=app');
      }
      const owners = await client.query<{ datname: string; owner: string }>(
        `SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database
          WHERE datname IN ('wallet', 'wallet_test') ORDER BY datname`,
      );
      expect(owners.rows).toEqual([
        { datname: 'wallet', owner: 'wallet_migrator' },
        { datname: 'wallet_test', owner: 'wallet_migrator' },
      ]);
    });
  });

  it('PLT-14 el esquema app pertenece al dueño y el rol de ejecución solo tiene USAGE', async () => {
    for (const database of ['wallet', 'wallet_test']) {
      await withClient(withDatabase(testDb.bootstrapUrl, database), async (client) => {
        const { rows } = await client.query<Record<string, unknown>>(
          `SELECT pg_get_userbyid(nspowner) AS owner,
                  has_schema_privilege('wallet_app', 'app', 'USAGE') AS app_usage,
                  has_schema_privilege('wallet_app', 'app', 'CREATE') AS app_create,
                  has_schema_privilege('wallet_app', 'public', 'CREATE') AS public_create,
                  has_database_privilege('wallet_app', current_database(), 'CONNECT') AS app_connect,
                  has_database_privilege('wallet_app', current_database(), 'TEMP') AS app_temp
             FROM pg_namespace WHERE nspname = 'app'`,
        );
        expect(rows[0], database).toEqual({
          owner: 'wallet_migrator',
          app_usage: true,
          app_create: false,
          public_create: false,
          app_connect: true,
          app_temp: false,
        });
      });
    }
  });

  it('PLT-14 el rol de ejecución no puede crear tablas', async () => {
    await withClient(testDb.appUrl, async (client) => {
      expect(await sqlState(client.query('CREATE TABLE app.intruso (id int)'))).toBe('42501');
      expect(await sqlState(client.query('CREATE TABLE public.intruso (id int)'))).toBe('42501');
    });
  });
});
