import { createContainer } from './composition.js';

/** Punto de entrada del proceso: arma el contenedor y arranca el servidor HTTP. */
export function main(): void {
  createContainer();
}

main();
