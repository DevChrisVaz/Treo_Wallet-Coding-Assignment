import { createMigratorDataSource } from '../../src/platform/persistence/data-sources.js';
import { testDb } from '../helpers/env.js';

/**
 * Antes de las pruebas de integración: aplica las migraciones pendientes en `wallet_test` con el rol
 * dueño. Requiere haber corrido `npm run db:bootstrap` (roles, bases y esquema).
 */
export default async function setup(): Promise<void> {
  const migrator = createMigratorDataSource(testDb.migratorUrl);
  await migrator.initialize();
  try {
    await migrator.runMigrations({ transaction: 'each' });
  } finally {
    await migrator.destroy();
  }
}
