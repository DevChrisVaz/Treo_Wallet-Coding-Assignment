import { ConfigError, loadConfig } from './platform/config/config.js';
import { gracefulShutdown } from './platform/lifecycle/graceful-shutdown.js';
import {
  assertRuntimeRoleIsNotSchemaOwner,
  createAppDataSource,
} from './platform/persistence/data-sources.js';
import { PeriodicTask } from './platform/scheduling/periodic-task.js';

/**
 * Punto de entrada del proceso: valida la configuración (PLT-08), se conecta con el rol de
 * ejecución, verifica que no sea el dueño del esquema, empieza a aceptar peticiones y, si está
 * habilitado, programa el ejecutor de transferencias programadas (TRF-30, D6). Con `SIGTERM` o
 * `SIGINT` se apaga en orden: deja de aceptar peticiones y detiene el ejecutor, espera la pasada en
 * curso y solo entonces cierra el pool.
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
  const scheduler = config.scheduler.enabled
    ? new PeriodicTask({
        name: 'scheduled-transfers',
        intervalMs: config.scheduler.intervalMs,
        run: () => container.scheduler.runner.runOnce(),
        logger: container.logger,
      })
    : null;
  const server = createApp(container).listen(config.port, config.host, () => {
    container.logger.info({ host: config.host, port: config.port }, 'api listening');
    scheduler?.start();
    container.logger.info(
      { enabled: config.scheduler.enabled, intervalMs: config.scheduler.intervalMs },
      'scheduled transfers runner',
    );
  });
  const shutdown = gracefulShutdown({
    stopWork: async () => scheduler?.stop(),
    closeServer: () => new Promise<void>((resolve) => server.close(() => resolve())),
    closePool: () => dataSource.destroy(),
  });
  const onSignal = () => {
    void shutdown().then(() => process.exit(0));
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}

main().catch((error: unknown) => {
  // Un error de configuración solo nombra las variables, sin sus valores (PLT-08).
  process.stderr.write(
    `${error instanceof ConfigError ? error.message : 'No se pudo iniciar la API'}\n`,
  );
  if (!(error instanceof ConfigError)) console.error(error);
  process.exit(1);
});
