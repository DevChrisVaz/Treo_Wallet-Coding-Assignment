/**
 * `npm run db:revert` (PLT-15): revierte la última migración aplicada con el rol dueño del esquema.
 * Con `-- --all` revierte todas, en orden inverso (lo usa el CI para la prueba ida-vuelta-ida).
 */
import { createMigratorDataSource } from '../src/platform/persistence/data-sources.js';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  process.stderr.write('Falta la variable MIGRATION_DATABASE_URL\n');
  process.exit(1);
}
const all = process.argv.includes('--all');

const dataSource = createMigratorDataSource(url);
await dataSource.initialize();

async function appliedCount(): Promise<number> {
  const [row] = await dataSource.query<{ count: string }[]>(
    `SELECT CASE WHEN to_regclass('app.typeorm_migrations') IS NULL THEN 0
                 ELSE (SELECT count(*) FROM app.typeorm_migrations) END AS count`,
  );
  return Number(row?.count ?? 0);
}

try {
  let reverted = 0;
  while ((await appliedCount()) > 0) {
    await dataSource.undoLastMigration({ transaction: 'each' });
    reverted += 1;
    if (!all) break;
  }
  process.stdout.write(`Migraciones revertidas: ${reverted}\n`);
} finally {
  await dataSource.destroy();
}
