/**
 * `npm run db:migrate` (PLT-15): aplica las migraciones pendientes con el rol dueño del esquema
 * (`MIGRATION_DATABASE_URL`). Sin migraciones pendientes no cambia nada.
 */
import { createMigratorDataSource } from '../src/platform/persistence/data-sources.js';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  process.stderr.write('Falta la variable MIGRATION_DATABASE_URL\n');
  process.exit(1);
}

const dataSource = createMigratorDataSource(url);
await dataSource.initialize();
try {
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  process.stdout.write(
    applied.length === 0
      ? 'Sin migraciones pendientes.\n'
      : applied.map((migration) => `Aplicada: ${migration.name}\n`).join(''),
  );
} finally {
  await dataSource.destroy();
}
