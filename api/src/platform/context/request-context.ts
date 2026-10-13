import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de la petición en curso (PLT-05): lo leen el logger, el traductor de errores y el
 * escritor de auditoría sin pasarlo de función en función.
 */
export interface RequestContext {
  readonly requestId: string;
  /** IP del cliente según `trust proxy` (PLT-07). */
  readonly ip: string | undefined;
  readonly userAgent: string | undefined;
  /** Se llena al autenticar la petición. */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
