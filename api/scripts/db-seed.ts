/**
 * `npm run db:seed` (PLT-13): datos de desarrollo con el rol dueño del esquema
 * (`MIGRATION_DATABASE_URL`). Idempotente: se puede correr de nuevo sin duplicar nada.
 */
import { loadConfig } from '../src/platform/config/config.js';
import { createMigratorDataSource } from '../src/platform/persistence/data-sources.js';
import { DEMO_USERS, seedDemoUsers } from '../src/seed/demo-users.js';

const config = loadConfig(process.env);
if (!config.migrationDatabaseUrl) {
  process.stderr.write('Falta la variable MIGRATION_DATABASE_URL\n');
  process.exit(1);
}

const migrator = createMigratorDataSource(config.migrationDatabaseUrl);
await migrator.initialize();
try {
  await seedDemoUsers(migrator, { clabe: config.clabe });
  for (const user of DEMO_USERS) {
    process.stdout.write(`Usuario demo listo: ${user.email}\n`);
  }
} finally {
  await migrator.destroy();
}
