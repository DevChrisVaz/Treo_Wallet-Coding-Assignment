/**
 * Cliente de la API para la app (diseño, decisión 3): `createApiClient` del contrato con
 * `Authorization: Bearer` desde la memoria y un plazo de 15 s por intento, para que una red colgada
 * se trate como pérdida de red (`NetworkError`, reintentable) y no como espera infinita.
 */
import { createApiClient, ProblemError, type ApiClient } from '@devchrisvaz/wallet-contract';

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

/** Pone el `User-Agent` de la app en cada intento (MOB-32); sin valor, no toca la petición. */
export function withUserAgent(fetchImpl: FetchFn, userAgent: string | undefined): FetchFn {
  if (!userAgent) return fetchImpl;
  return (request) => {
    request.headers.set('User-Agent', userAgent);
    return fetchImpl(request);
  };
}

export interface TokenRefresher {
  /** Access token nuevo, o `null` si la sesión quedó revocada (y ya se limpió). */
  refresh(): Promise<string | null>;
}

async function problemCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json();
    return body && typeof body === 'object' && 'code' in body ? String(body.code) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Renovación de una sola vez (MOB-03): ante `401 UNAUTHENTICATED` de una petición autenticada,
 * obtiene un access nuevo (renovación compartida entre peticiones simultáneas) y repite la petición
 * original una sola vez. Si otra petición ya renovó mientras esta viajaba, la repite con el access
 * vigente sin renovar de nuevo.
 */
export function withSessionRefresh(
  fetchImpl: FetchFn,
  session: Session,
  refresher: TokenRefresher,
): FetchFn {
  return async (request) => {
    const sentAuthorization = request.headers.get('Authorization');
    const replay = sentAuthorization ? request.clone() : undefined;
    const response = await fetchImpl(request);
    if (response.status !== 401 || !replay) return response;
    if ((await problemCode(response)) !== 'UNAUTHENTICATED') return response;

    const current = session.getAccessToken();
    const token =
      current && `Bearer ${current}` !== sentAuthorization ? current : await refresher.refresh();
    if (!token) return response;
    replay.headers.set('Authorization', `Bearer ${token}`);
    return fetchImpl(replay);
  };
}

export interface WalletApiOptions {
  baseUrl: string;
  session: Session;
  fetch?: FetchFn;
  timeoutMs?: number;
  /** `User-Agent` de la app (MOB-32). */
  userAgent?: string | undefined;
}

const globalFetch: FetchFn = (request) => globalThis.fetch(request);

/**
 * Renovación compartida: si ya hay una en curso, las demás peticiones esperan la misma promesa.
 * Usa un cliente sin `Authorization` (el endpoint no la requiere). Un `401` (o un token que la API
 * no acepta) limpia la sesión; un error de red o de servidor la conserva para reintentar con el
 * mismo refresh dentro de la ventana de gracia de la API.
 */
export function createSessionRefresher({
  baseUrl,
  session,
  fetch = globalFetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  userAgent,
}: WalletApiOptions): TokenRefresher {
  const bare = createApiClient({
    baseUrl,
    fetch: withUserAgent(withTimeout(fetch, timeoutMs), userAgent),
  });
  let inflight: Promise<string | null> | null = null;

  async function run(): Promise<string | null> {
    const refreshToken = await session.readRefreshToken();
    if (!refreshToken) {
      await session.clear('revoked');
      return null;
    }
    try {
      const { data } = await bare.POST('/auth/refresh', { body: { refreshToken } });
      if (!data) throw new Error('Respuesta de renovación vacía');
      await session.replaceTokens(data);
      return data.accessToken;
    } catch (error) {
      if (error instanceof ProblemError && (error.status === 401 || error.status === 422)) {
        await session.clear('revoked');
        return null;
      }
      throw error;
    }
  }

  return {
    refresh() {
      inflight ??= run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}

export function createWalletApi({
  baseUrl,
  session,
  fetch = globalFetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  userAgent,
  refresher,
}: WalletApiOptions & { refresher?: TokenRefresher }): ApiClient {
  const attempt = withUserAgent(withTimeout(fetch, timeoutMs), userAgent);
  return createApiClient({
    baseUrl,
    getAccessToken: () => session.getAccessToken(),
    fetch: refresher ? withSessionRefresh(attempt, session, refresher) : attempt,
  });
}
