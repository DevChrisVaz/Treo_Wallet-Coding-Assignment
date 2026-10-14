import 'server-only';
import {
  createApiClient,
  ProblemError,
  toProblemError,
  type ApiClient,
} from '@devchrisvaz/wallet-contract';
import { serverEnv } from './env';
import type { RequestContext } from './request-context';
import { sessionStore, type SessionData } from './session-store';

/** La sesión ya no existe (inactividad, logout) o la API revocó su refresh token. */
export class SessionEndedError extends Error {
  override readonly name = 'SessionEndedError';

  constructor(readonly code: 'UNAUTHENTICATED' | 'SESSION_REVOKED') {
    super(code);
  }
}

/** Se renueva el access token si vence en menos de este margen (D3 de web-app). */
const REFRESH_MARGIN_MS = 30_000;

type Middleware = Parameters<ApiClient['use']>[0];

const RETRY_AFTER = Symbol('retryAfter');

/** Segundos de `Retry-After` de un `429`, conservados en el `ProblemError` (WEB-12). */
export function retryAfterOf(error: unknown): number | undefined {
  if (error instanceof ProblemError) {
    return (error as ProblemError & { [RETRY_AFTER]?: number })[RETRY_AFTER];
  }
  return undefined;
}

function parseRetryAfter(value: string | null): number | undefined {
  return value && /^[0-9]{1,6}$/.test(value) ? Number.parseInt(value, 10) : undefined;
}

/** Agrega `X-Forwarded-For` (el cliente del contrato ya agrega `X-Request-Id`). */
function forwardedForMiddleware(context: RequestContext): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set('X-Forwarded-For', context.clientIp);
      return request;
    },
  };
}

/**
 * Convierte las respuestas de error en `ProblemError` conservando `Retry-After`. Corre antes que el
 * middleware de errores del contrato porque openapi-fetch ejecuta `onResponse` en orden inverso.
 */
const problemWithRetryAfter: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined;
    const problem = await toProblemError(response);
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    if (retryAfter !== undefined) {
      Object.defineProperty(problem, RETRY_AFTER, { value: retryAfter });
    }
    throw problem;
  },
};

function createClient(context: RequestContext, getAccessToken?: () => Promise<string>): ApiClient {
  const client = createApiClient({
    baseUrl: serverEnv().apiBaseUrl,
    getRequestId: () => context.requestId,
    ...(getAccessToken ? { getAccessToken } : {}),
  });
  client.use(forwardedForMiddleware(context), problemWithRetryAfter);
  return client;
}

/** Cliente sin sesión: registro, verificación, login, refresh y logout. */
export function publicApi(context: RequestContext): ApiClient {
  return createClient(context);
}

// Renovaciones en curso por sesión: las peticiones concurrentes esperan la misma promesa (WEB-04).
const globalRefreshes = globalThis as typeof globalThis & {
  __treoWalletRefreshes?: Map<string, Promise<string>>;
};

function refreshesInFlight(): Map<string, Promise<string>> {
  globalRefreshes.__treoWalletRefreshes ??= new Map();
  return globalRefreshes.__treoWalletRefreshes;
}

async function refresh(
  sessionId: string,
  session: SessionData,
  context: RequestContext,
): Promise<string> {
  const store = sessionStore();
  try {
    const { data } = await publicApi(context).POST('/auth/refresh', {
      body: { refreshToken: session.refreshToken },
    });
    if (!data) throw new Error('refreshSession respondió sin tokens');
    const latest = (await store.get(sessionId)) ?? session;
    await store.set(sessionId, {
      ...latest,
      accessToken: data.accessToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      refreshToken: data.refreshToken,
      refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    });
    return data.accessToken;
  } catch (error) {
    // La API responde 401 SESSION_REVOKED con un refresh inválido, vencido o revocado.
    if (error instanceof ProblemError && error.status === 401) {
      await store.delete(sessionId);
      throw new SessionEndedError('SESSION_REVOKED');
    }
    throw error;
  }
}

/** Access token vigente de la sesión; si vence pronto, una sola renovación por sesión. */
export async function accessTokenFor(sessionId: string, context: RequestContext): Promise<string> {
  const session = await sessionStore().get(sessionId);
  if (!session) throw new SessionEndedError('UNAUTHENTICATED');
  if (Date.parse(session.accessTokenExpiresAt) - Date.now() > REFRESH_MARGIN_MS) {
    return session.accessToken;
  }
  const refreshes = refreshesInFlight();
  let pending = refreshes.get(sessionId);
  if (!pending) {
    pending = refresh(sessionId, session, context).finally(() => refreshes.delete(sessionId));
    refreshes.set(sessionId, pending);
  }
  return pending;
}

/** Cliente con la sesión del servidor: adjunta el Bearer vigente en cada petición. */
export function sessionApi(sessionId: string, context: RequestContext): ApiClient {
  return createClient(context, () => accessTokenFor(sessionId, context));
}
