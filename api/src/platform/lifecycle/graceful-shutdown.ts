export interface ShutdownSteps {
  /** Detiene el trabajo en segundo plano y espera la pasada en curso (el ejecutor de programadas). */
  readonly stopWork: () => Promise<void>;
  /** Deja de aceptar conexiones y espera las peticiones en curso. */
  readonly closeServer: () => Promise<void>;
  /** Cierra el pool de PostgreSQL. */
  readonly closePool: () => Promise<void>;
}

/**
 * Apagado ordenado (D6 de scheduled-transfers): el trabajo en segundo plano y el servidor HTTP se
 * detienen a la vez y el pool se cierra solo cuando ambos terminaron, para que ninguna transacción
 * pierda su conexión a la mitad. Devuelve una función idempotente: una segunda señal (SIGINT después
 * de SIGTERM) espera el mismo apagado en lugar de repetirlo.
 */
export function gracefulShutdown(steps: ShutdownSteps): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    running ??= (async () => {
      await Promise.all([steps.stopWork(), steps.closeServer()]);
      await steps.closePool();
    })();
    return running;
  };
}
