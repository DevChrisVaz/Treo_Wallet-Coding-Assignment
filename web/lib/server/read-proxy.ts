import 'server-only';
import type { ProblemCode } from '@devchrisvaz/wallet-contract';
import { accessTokenFor, SessionEndedError } from './api-client';
import { endLocalSession, currentSession } from './action';
import { serverEnv } from './env';
import { logUnexpectedError } from './log';
import { forwardHeaders, requestContextFrom, type RequestContext } from './request-context';

/*
 * Proxy de lecturas (D4 de web-app, WEB-09): solo GET, solo las rutas de la lista blanca y siempre
 * hacia API_BASE_URL. Adjunta el Bearer de la sesión del servidor; el navegador nunca lo ve.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lista blanca: cada patrón acepta exactamente sus segmentos; los ids deben ser UUID. */
const ALLOWED_READS: ReadonlyArray<(segments: readonly string[]) => boolean> = [
  (s) => s.length === 1 && s[0] === 'accounts',
  (s) => s.length === 2 && s[0] === 'accounts' && UUID.test(s[1] ?? ''),
  (s) => s.length === 3 && s[0] === 'accounts' && UUID.test(s[1] ?? '') && s[2] === 'movements',
  (s) => s.length === 1 && s[0] === 'beneficiaries',
  (s) => s.length === 2 && s[0] === 'transfers' && UUID.test(s[1] ?? ''),
];

/** Ruta de la API para los segmentos pedidos, o `null` si no está en la lista blanca. */
export function allowedApiPath(segments: readonly string[]): string | null {
  return ALLOWED_READS.some((matches) => matches(segments)) ? `/${segments.join('/')}` : null;
}

export function problemResponse(
  context: RequestContext,
  status: number,
  code: ProblemCode,
  title: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    {
      type: `/problems/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      code,
      requestId: context.requestId,
    },
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'no-store',
        'X-Request-Id': context.requestId,
        ...headers,
      },
    },
  );
}

/** Reenvía una lectura permitida a la API con el Bearer de la sesión. */
export async function proxyRead(request: Request, segments: readonly string[]): Promise<Response> {
  const context = requestContextFrom(request.headers);
  const path = allowedApiPath(segments);
  if (!path) return problemResponse(context, 404, 'NOT_FOUND', 'No encontrado');

  const current = await currentSession();
  if (!current) {
    await endLocalSession();
    return problemResponse(context, 401, 'UNAUTHENTICATED', 'Sesión terminada');
  }

  try {
    const token = await accessTokenFor(current.sessionId, context);
    const url = new URL(path, serverEnv().apiBaseUrl);
    url.search = new URL(request.url).search;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        ...forwardHeaders(context),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json, application/problem+json',
      },
      cache: 'no-store',
    });
    if (upstream.status === 401) await endLocalSession();
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-Id': upstream.headers.get('X-Request-Id') ?? context.requestId,
      },
    });
  } catch (error) {
    if (error instanceof SessionEndedError) {
      await endLocalSession();
      return problemResponse(context, 401, error.code, 'Sesión terminada');
    }
    logUnexpectedError(context.requestId, error);
    return problemResponse(context, 503, 'INTERNAL_ERROR', 'Servicio no disponible');
  }
}

/** Cualquier método distinto de GET: 405 sin llamar a la API. */
export function methodNotAllowed(request: Request): Response {
  return problemResponse(
    requestContextFrom(request.headers),
    405,
    'MALFORMED_REQUEST',
    'Método no permitido',
    { Allow: 'GET' },
  );
}
