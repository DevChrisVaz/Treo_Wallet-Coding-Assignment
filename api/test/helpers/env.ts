/**
 * Conexiones de las pruebas de integración. Vienen de las variables de entorno (en local, de `.env`,
 * que carga `vitest.config.ts`; en CI, del workflow) con los valores de `.env.example` por defecto.
 */
export const testDb = {
  /** Rol de ejecución (`wallet_app`) sobre la base de pruebas: lo usa el código bajo prueba. */
  appUrl:
    process.env.TEST_DATABASE_URL ??
    'postgres://wallet_app:wallet_app_dev_password@localhost:5433/wallet_test',
  /** Rol dueño (`wallet_migrator`): migra y reinicia los datos entre pruebas. */
  migratorUrl:
    process.env.TEST_MIGRATION_DATABASE_URL ??
    'postgres://wallet_migrator:wallet_migrator_dev_password@localhost:5433/wallet_test',
  /** Superusuario: solo para inspeccionar roles y bases creados por el bootstrap. */
  bootstrapUrl:
    process.env.BOOTSTRAP_DATABASE_URL ??
    'postgres://postgres:postgres_dev_password@localhost:5433/postgres',
} as const;

/** Misma URL con otra base de datos. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}
