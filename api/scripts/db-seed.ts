/**
 * `npm run db:seed` (PLT-13, HIS-10): datos de desarrollo con el rol dueño del esquema
 * (`MIGRATION_DATABASE_URL`). Idempotente: se puede correr de nuevo sin duplicar nada.
 */
import { loadConfig } from '../src/platform/config/config.js';
import { createMigratorDataSource } from '../src/platform/persistence/data-sources.js';
import { seedDemoData } from '../src/seed/demo-data.js';
import { DEMO_USERS } from '../src/seed/demo-users.js';
import { seedWindow } from '../src/seed/window.js';

const config = loadConfig(process.env);
if (!config.migrationDatabaseUrl) {
  process.stderr.write('Falta la variable MIGRATION_DATABASE_URL\n');
  process.exit(1);
}

const migrator = createMigratorDataSource(config.migrationDatabaseUrl);
await migrator.initialize();
try {
  const window = seedWindow(new Date());
  const data = await seedDemoData(migrator, {
    clabe: config.clabe,
    generatedUsers: 50,
    fundedAt: window.fundedAt,
  });
  for (const user of DEMO_USERS) {
    process.stdout.write(`Usuario demo listo: ${user.email}\n`);
  }
  process.stdout.write(`Usuarios generados: ${data.others.length - 1}\n`);
} finally {
  await migrator.destroy();
}
