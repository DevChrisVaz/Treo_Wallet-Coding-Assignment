/**
 * `npm run db:seed` (PLT-13, HIS-10): datos de desarrollo con el rol dueño del esquema
 * (`MIGRATION_DATABASE_URL`): usuarios demo y generados, beneficiarios, fondeo inicial y ~60k
 * transferencias en 12 meses que terminan ayer. Termina verificando las invariantes del ledger y
 * falla si alguna no se cumple. Idempotente: se puede correr de nuevo sin duplicar nada.
 */
import { loadConfig } from '../src/platform/config/config.js';
import { createMigratorDataSource } from '../src/platform/persistence/data-sources.js';
import { DEMO_USERS } from '../src/seed/demo-users.js';
import { SeedInvariantError, runSeed } from '../src/seed/run-seed.js';

const config = loadConfig(process.env);
if (!config.migrationDatabaseUrl) {
  process.stderr.write('Falta la variable MIGRATION_DATABASE_URL\n');
  process.exit(1);
}

const migrator = createMigratorDataSource(config.migrationDatabaseUrl);
await migrator.initialize();
const started = performance.now();
try {
  const summary = await runSeed(migrator, {
    clabe: config.clabe,
    now: new Date(),
    generatedUsers: 50,
    transfers: 60_000,
    batchSize: 5_000,
    monthlyDeposits: 12,
    minEntries: 100_000,
  });
  for (const user of DEMO_USERS) {
    process.stdout.write(`Usuario demo listo: ${user.email}\n`);
  }
  process.stdout.write(
    summary.volume.skipped
      ? 'Volumen ya generado: no se agregó nada\n'
      : `Transferencias generadas: ${summary.volume.transfers} (+${summary.volume.deposits} depósitos)\n`,
  );
  process.stdout.write(
    `Asientos: ${summary.entries} (${summary.anaPrincipalEntries} en "Principal" de Ana); invariantes OK\n`,
  );
  process.stdout.write(`Tiempo: ${((performance.now() - started) / 1000).toFixed(1)} s\n`);
} catch (error) {
  if (error instanceof SeedInvariantError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await migrator.destroy();
}
