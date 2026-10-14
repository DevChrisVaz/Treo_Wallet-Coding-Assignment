/**
 * `npm run db:bootstrap` (PLT-14): crea o reafirma roles, bases y esquema ejecutando
 * `db/bootstrap.sql` con psql como superusuario. Las contraseñas de los roles viajan por variables de
 * entorno hacia psql (`\getenv`), nunca como argumentos.
 *
 * Usa el psql instalado si existe (CI); si no, el de la imagen de PostgreSQL de docker compose, que
 * se conecta por el socket local del contenedor.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sqlFile = resolve(root, 'db/bootstrap.sql');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`Falta la variable ${name}\n`);
    process.exit(1);
  }
  return value;
}

const bootstrapUrl = requireEnv('BOOTSTRAP_DATABASE_URL');
requireEnv('WALLET_MIGRATOR_PASSWORD');
requireEnv('WALLET_APP_PASSWORD');

const env = { ...process.env, PGOPTIONS: '-c client_min_messages=warning' };
const psqlAvailable = spawnSync('psql', ['--version'], { stdio: 'ignore' }).status === 0;

const result = psqlAvailable
  ? spawnSync('psql', [bootstrapUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', sqlFile], {
      env,
      stdio: 'inherit',
    })
  : spawnSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        '-e',
        'WALLET_MIGRATOR_PASSWORD',
        '-e',
        'WALLET_APP_PASSWORD',
        '-e',
        'PGOPTIONS',
        'postgres',
        'psql',
        '-X',
        '-q',
        '-U',
        decodeURIComponent(new URL(bootstrapUrl).username) || 'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '-',
      ],
      { cwd: root, env, input: readFileSync(sqlFile), stdio: ['pipe', 'inherit', 'inherit'] },
    );

if (result.error) {
  process.stderr.write(`No se pudo ejecutar psql: ${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
process.stdout.write('Bootstrap de la base de datos completo.\n');
