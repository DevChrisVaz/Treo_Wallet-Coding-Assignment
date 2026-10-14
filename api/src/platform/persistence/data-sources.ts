import { DataSource } from 'typeorm';
import { migrations } from '../../../migrations/index.js';
import { entities } from '../../entities.js';

const SCHEMA = 'app';

/**
 * DataSource de ejecución (rol `wallet_app`): lo usa la API. Nunca sincroniza ni migra (PLT-15);
 * el esquema cambia solo con migraciones ejecutadas por el rol dueño.
 */
export function createAppDataSource(url: string, poolSize = 20): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    schema: SCHEMA,
    applicationName: 'wallet-api',
    entities,
    synchronize: false,
    migrationsRun: false,
    poolSize,
  });
}

/** DataSource del dueño del esquema (rol `wallet_migrator`): migraciones, seed y arnés de pruebas. */
export function createMigratorDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    schema: SCHEMA,
    applicationName: 'wallet-migrator',
    entities,
    migrations,
    migrationsTableName: 'typeorm_migrations',
    migrationsTransactionMode: 'each',
    synchronize: false,
    migrationsRun: false,
    poolSize: 5,
  });
}

/**
 * Verificación de arranque (PLT-08): la API no debe correr con el rol dueño del esquema ni con un
 * superusuario, porque podrían alterar el esquema o saltarse los triggers de auditoría.
 */
export async function assertRuntimeRoleIsNotSchemaOwner(dataSource: DataSource): Promise<void> {
  const rows: { role: string; owner: string | null; superuser: boolean }[] = await dataSource.query(
    `SELECT current_user AS role,
              (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = $1) AS owner,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`,
    [SCHEMA],
  );
  const [row] = rows;
  if (!row || row.superuser || row.role === row.owner) {
    throw new Error(
      'DATABASE_URL debe usar el rol de ejecución (wallet_app), no el dueño del esquema ni un superusuario',
    );
  }
}
