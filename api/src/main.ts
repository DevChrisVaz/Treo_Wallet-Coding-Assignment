import { createContainer } from './composition.js';
import { ConfigError, loadConfig } from './platform/config/config.js';

/** Punto de entrada del proceso: valida la configuración, arma el contenedor y arranca el servidor. */
export function main(): void {
  const config = loadConfig(process.env);
  createContainer(config);
}

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    // Solo el mensaje: nombra las variables inválidas sin mostrar sus valores (PLT-08).
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
