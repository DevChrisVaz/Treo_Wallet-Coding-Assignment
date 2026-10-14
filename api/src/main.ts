import { ConfigError, loadConfig } from './platform/config/config.js';
import {
  assertRuntimeRoleIsNotSchemaOwner,
  createAppDataSource,
} from './platform/persistence/data-sources.js';

/**
 * Punto de entrada del proceso: valida la configuración (PLT-08), se conecta con el rol de
 * ejecución, verifica que no sea el dueño del esquema y empieza a aceptar peticiones.
 */
export async function main(): Promise<void> {
  const config = loadConfig(process.env);
  // La aplicación (con PDFKit y las fuentes del estado de cuenta) se carga después de validar la
  // configuración: un error de configuración termina sin cargar nada más.
  const { createApp, createContainer } = await import('./composition.js');
  const dataSource = createAppDataSource(config.databaseUrl);
  await dataSource.initialize();
  await assertRuntimeRoleIsNotSchemaOwner(dataSource);
  const container = await createContainer(config, { dataSource });
  const server = createApp(container).listen(config.port, config.host, () => {
    container.logger.info({ host: config.host, port: config.port }, 'api listening');
  });
  const shutdown = () => {
    server.close(() => void dataSource.destroy().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  // Un error de configuración solo nombra las variables, sin sus valores (PLT-08).
  process.stderr.write(
    `${error instanceof ConfigError ? error.message : 'No se pudo iniciar la API'}\n`,
  );
  if (!(error instanceof ConfigError)) console.error(error);
  process.exit(1);
});
