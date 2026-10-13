/**
 * Cliente de la API para la app (diseño, decisión 3): `createApiClient` del contrato con
 * `Authorization: Bearer` desde la memoria y un plazo de 15 s por intento, para que una red colgada
 * se trate como pérdida de red (`NetworkError`, reintentable) y no como espera infinita.
 */
import { createApiClient, type ApiClient } from '@devchrisvaz/wallet-contract';

import type { Session } from '@/session/session';

export const REQUEST_TIMEOUT_MS = 15_000;

export type FetchFn = (request: Request) => Promise<Response>;

export class RequestTimeoutError extends Error {
  override readonly name = 'RequestTimeoutError';

  constructor() {
    super(`La API no respondió en ${REQUEST_TIMEOUT_MS / 1000} s`);
  }
}

/**
 * Corta cada intento al vencer el plazo: aborta la petición y rechaza aunque la implementación de
 * `fetch` no respete la señal. El rechazo llega al cliente como `NetworkError`.
 */
export function withTimeout(fetchImpl: FetchFn, timeoutMs: number): FetchFn {
  return async (request) => {
    const controller = new AbortController();
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new RequestTimeoutError()));
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await Promise.race([
        fetchImpl(new Request(request, { signal: controller.signal })),
        timedOut,
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface WalletApiOptions {
  baseUrl: string;
  session: Session;
  fetch?: FetchFn;
  timeoutMs?: number;
}

export function createWalletApi({
  baseUrl,
  session,
  fetch = (request) => globalThis.fetch(request),
  timeoutMs = REQUEST_TIMEOUT_MS,
}: WalletApiOptions): ApiClient {
  return createApiClient({
    baseUrl,
    getAccessToken: () => session.getAccessToken(),
    fetch: withTimeout(fetch, timeoutMs),
  });
}
