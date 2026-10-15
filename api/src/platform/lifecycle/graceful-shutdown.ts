/** Tope de espera de los avisos: el SMTP tarda hasta 5 s en conectar y ECS da 30 s hasta SIGKILL. */
export const NOTICE_DRAIN_TIMEOUT_MS = 5_000;

export interface ShutdownSteps {
  /** Detiene el trabajo en segundo plano y espera la pasada en curso (el ejecutor de programadas). */
  readonly stopWork: () => Promise<void>;
  /** Deja de aceptar conexiones y espera las peticiones en curso. */
  readonly closeServer: () => Promise<void>;
  /**
   * Espera los avisos por correo en vuelo (PLT-16, D8 de security-hardening). Corre cuando el
   * servidor ya no recibe peticiones y el trabajo en segundo plano terminó, así que ya no se encolan
   * más; su propio tope evita que un servidor de correo mudo retrase el apagado.
   */
  readonly drainNotices?: () => Promise<unknown>;
  /** Cierra el pool de PostgreSQL. */
  readonly closePool: () => Promise<void>;
}

/**
 * Apagado ordenado (D6 de scheduled-transfers): el trabajo en segundo plano y el servidor HTTP se
 * detienen a la vez; cuando ambos terminaron se esperan los avisos en vuelo y, al final, se cierra el
 * pool, para que ninguna transacción pierda su conexión a la mitad. Devuelve una función idempotente:
 * una segunda señal (SIGINT después de SIGTERM) espera el mismo apagado en lugar de repetirlo.
 */
export function gracefulShutdown(steps: ShutdownSteps): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    running ??= (async () => {
      await Promise.all([steps.stopWork(), steps.closeServer()]);
      await steps.drainNotices?.();
      await steps.closePool();
    })();
    return running;
  };
}
