import { createContainer } from './composition.js';
import { ConfigError, loadConfig } from './platform/config/config.js';
import {
  assertRuntimeRoleIsNotSchemaOwner,
  createAppDataSource,
} from './platform/persistence/data-sources.js';

/**
 * Punto de entrada del proceso: valida la configuración (PLT-08), se conecta con el rol de
 * ejecución y verifica que no sea el dueño del esquema antes de aceptar peticiones.
 */
export async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const dataSource = createAppDataSource(config.databaseUrl);
  await dataSource.initialize();
  await assertRuntimeRoleIsNotSchemaOwner(dataSource);
  createContainer(config);
}

main().catch((error: unknown) => {
  // Un error de configuración solo nombra las variables, sin sus valores (PLT-08).
  process.stderr.write(
    `${error instanceof ConfigError ? error.message : 'No se pudo iniciar la API'}\n`,
  );
  if (!(error instanceof ConfigError)) console.error(error);
  process.exit(1);
});
