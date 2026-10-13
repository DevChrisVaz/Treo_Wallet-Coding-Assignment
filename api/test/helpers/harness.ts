import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../migrations/1760400002000-accounts.js';
import {
  createAppDataSource,
  createMigratorDataSource,
} from '../../src/platform/persistence/data-sources.js';
import { testDb } from './env.js';

export interface IntegrationHarness {
  /** Conexión con el rol de ejecución: la que recibe el código bajo prueba. */
  readonly app: DataSource;
  /** Conexión con el rol dueño: inspección y reinicio de datos. */
  readonly migrator: DataSource;
  reset(): Promise<void>;
}

/**
 * Deja la base de pruebas como recién migrada: vacía todas las tablas del esquema y vuelve a crear
 * la Tesorería. Para poder truncar las tablas de solo inserción desactiva sus triggers de
 * protección dentro de la misma transacción y los reactiva antes del COMMIT. Es exactamente el
 * bypass del dueño del esquema que AUD-05 reconoce; el código de la aplicación nunca lo hace.
 */
export async function resetDatabase(migrator: DataSource): Promise<void> {
  const runner = migrator.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction();
    const triggers: { tbl: string; name: string }[] = await runner.query(
      `SELECT format('app.%I', c.relname) AS tbl, t.tgname AS name
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal
          AND c.relnamespace = 'app'::regnamespace
          AND t.tgfoid = 'app.forbid_mutation()'::regprocedure`,
    );
    const tables: { tbl: string }[] = await runner.query(
      `SELECT format('app.%I', relname) AS tbl FROM pg_class
        WHERE relnamespace = 'app'::regnamespace AND relkind = 'r'
          AND relname <> 'typeorm_migrations'`,
    );
    for (const trigger of triggers) {
      await runner.query(`ALTER TABLE ${trigger.tbl} DISABLE TRIGGER ${trigger.name}`);
    }
    await runner.query(`TRUNCATE ${tables.map((t) => t.tbl).join(', ')} RESTART IDENTITY CASCADE`);
    for (const trigger of triggers) {
      await runner.query(`ALTER TABLE ${trigger.tbl} ENABLE TRIGGER ${trigger.name}`);
    }
    await runner.query(
      `INSERT INTO app.accounts (id, type, name) VALUES ($1, 'SYSTEM', 'Tesorería')`,
      [TREASURY_ACCOUNT_ID],
    );
    await runner.commitTransaction();
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

/**
 * Arnés de pruebas de integración (PLT-13): las migraciones ya se aplicaron en el global setup;
 * aquí se abren las dos conexiones y se reinician los datos antes de cada prueba.
 */
export function useIntegrationHarness(): IntegrationHarness {
  const app = createAppDataSource(testDb.appUrl);
  const migrator = createMigratorDataSource(testDb.migratorUrl);
  const harness: IntegrationHarness = { app, migrator, reset: () => resetDatabase(migrator) };

  beforeAll(async () => {
    await Promise.all([app.initialize(), migrator.initialize()]);
  });
  beforeEach(async () => {
    await harness.reset();
  });
  afterAll(async () => {
    await Promise.all([app.destroy(), migrator.destroy()]);
  });
  return harness;
}
