import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertRuntimeRoleIsNotSchemaOwner,
  createAppDataSource,
  createMigratorDataSource,
} from '../../../src/platform/persistence/data-sources.js';
import {
  queryForUpdate,
  queryRunnerOf,
  TypeormTransactionRunner,
} from '../../../src/platform/persistence/transaction.js';
import { testDb } from '../../helpers/env.js';

const migrator = createMigratorDataSource(testDb.migratorUrl);
const app = createAppDataSource(testDb.appUrl);

beforeAll(async () => {
  await migrator.initialize();
  await app.initialize();
  // Tabla de sondeo solo para esta prueba; el rol dueño la crea y la borra al final.
  await migrator.query('DROP TABLE IF EXISTS app.lock_probe');
  await migrator.query(
    'CREATE TABLE app.lock_probe (id int CONSTRAINT pk_lock_probe PRIMARY KEY, value int NOT NULL)',
  );
  await migrator.query('INSERT INTO app.lock_probe VALUES (1, 0)');
});

afterAll(async () => {
  await migrator.query('DROP TABLE IF EXISTS app.lock_probe');
  await app.destroy();
  await migrator.destroy();
});

describe('PLT-15 DataSources', () => {
  it('PLT-15 ninguno sincroniza ni migra el esquema al iniciar', () => {
    for (const source of [app, migrator]) {
      expect(source.options.synchronize).toBe(false);
      expect(source.options.migrationsRun).toBe(false);
    }
  });

  it('PLT-08 la conexión de ejecución usa el rol de ejecución', async () => {
    await expect(assertRuntimeRoleIsNotSchemaOwner(app)).resolves.toBeUndefined();
  });

  it('PLT-08 se niega a arrancar si la conexión de ejecución es el dueño del esquema', async () => {
    await expect(assertRuntimeRoleIsNotSchemaOwner(migrator)).rejects.toThrow(/DATABASE_URL/);
  });
});

describe('PLT-15 helper de transacciones', () => {
  const runner = new TypeormTransactionRunner(migrator);

  it('PLT-15 confirma la transacción cuando el trabajo termina bien', async () => {
    await runner.run((tx) =>
      queryRunnerOf(tx).query('UPDATE app.lock_probe SET value = 10 WHERE id = 1'),
    );
    const [row] = await migrator.query('SELECT value FROM app.lock_probe WHERE id = 1');
    expect(row.value).toBe(10);
  });

  it('PLT-15 revierte la transacción cuando el trabajo falla', async () => {
    await expect(
      runner.run(async (tx) => {
        await queryRunnerOf(tx).query('UPDATE app.lock_probe SET value = 99 WHERE id = 1');
        throw new Error('falla a mitad de la transacción');
      }),
    ).rejects.toThrow('falla a mitad');
    const [row] = await migrator.query('SELECT value FROM app.lock_probe WHERE id = 1');
    expect(row.value).toBe(10);
  });

  it('PLT-15 SELECT … FOR UPDATE hace esperar a una segunda transacción hasta el COMMIT', async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstHoldsLock = new Promise<void>((resolve) => (releaseFirst = resolve));
    let firstLocked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (firstLocked = resolve));

    const first = runner.run(async (tx) => {
      await queryForUpdate(tx, 'SELECT value FROM app.lock_probe WHERE id = $1 FOR UPDATE', [1]);
      events.push('primera bloqueó');
      firstLocked();
      await firstHoldsLock;
      await queryRunnerOf(tx).query('UPDATE app.lock_probe SET value = value + 1 WHERE id = 1');
      events.push('primera confirma');
    });

    await lockTaken;
    const second = runner.run(async (tx) => {
      const [row] = await queryForUpdate<{ value: number }>(
        tx,
        'SELECT value FROM app.lock_probe WHERE id = $1 FOR UPDATE',
        [1],
      );
      events.push(`segunda leyó ${row?.value}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events).toEqual(['primera bloqueó']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['primera bloqueó', 'primera confirma', 'segunda leyó 11']);
  });

  it('PLT-15 queryForUpdate exige una cláusula de bloqueo explícita', async () => {
    await expect(
      runner.run((tx) => queryForUpdate(tx, 'SELECT value FROM app.lock_probe WHERE id = $1', [1])),
    ).rejects.toThrow(/FOR UPDATE/);
  });
});
