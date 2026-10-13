import type { AppConfig } from './platform/config/config.js';

/**
 * Raíz de composición (PLT-18). Construye los adaptadores de infraestructura, los inyecta a mano en
 * los casos de uso de cada módulo y entrega lo que necesita la capa HTTP. No hay contenedor de DI:
 * cada dependencia se pasa explícitamente con funciones fábrica, y las pruebas sustituyen adaptadores
 * pasando otros al construir el contenedor.
 */
export interface Container {
  readonly config: AppConfig;
}

export function createContainer(config: AppConfig): Container {
  return Object.freeze({ config });
}
