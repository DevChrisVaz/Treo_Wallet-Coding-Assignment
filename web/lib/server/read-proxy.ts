import 'server-only';
import type { ProblemCode } from '@devchrisvaz/wallet-contract';
import { accessTokenFor, SessionEndedError } from './api-client';
import { currentSession, endLocalSession } from './session';
import { serverEnv } from './env';
import { logUnexpectedError } from './log';
import { forwardHeaders, requestContextFrom, type RequestContext } from './request-context';

/*
 * Proxy de lecturas (D4 de web-app, WEB-09): solo GET, solo las rutas de la lista blanca y siempre
 * hacia API_BASE_URL. Adjunta el Bearer de la sesión del servidor; el navegador nunca lo ve.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Forma `AAAA-MM`; el mes válido lo decide la API (422 con su mensaje). */
const PERIOD = /^[0-9]{4}-[0-9]{2}$/;

interface AllowedRead {
  readonly matches: (segments: readonly string[]) => boolean;
  /** El cuerpo son bytes (el PDF del estado de cuenta), no JSON. */
  readonly binary?: true;
}

/** Lista blanca: cada patrón acepta exactamente sus segmentos; los ids deben ser UUID. */
const ALLOWED_READS: readonly AllowedRead[] = [
  { matches: (s) => s.length === 1 && s[0] === 'accounts' },
  { matches: (s) => s.length === 2 && s[0] === 'accounts' && UUID.test(s[1] ?? '') },
  {
    matches: (s) =>
      s.length === 3 && s[0] === 'accounts' && UUID.test(s[1] ?? '') && s[2] === 'movements',
  },
  {
    matches: (s) =>
      s.length === 4 &&
      s[0] === 'accounts' &&
      UUID.test(s[1] ?? '') &&
      s[2] === 'statements' &&
      PERIOD.test(s[3] ?? ''),
    binary: true,
  },
  { matches: (s) => s.length === 1 && s[0] === 'beneficiaries' },
  // Programadas (`listScheduledTransfers`, WEB-34): exactamente `transfers/scheduled`.
  { matches: (s) => s.length === 2 && s[0] === 'transfers' && s[1] === 'scheduled' },
  { matches: (s) => s.length === 2 && s[0] === 'transfers' && UUID.test(s[1] ?? '') },
];

/** La lectura de la lista blanca que corresponde a los segmentos pedidos, si hay una. */
function allowedRead(segments: readonly string[]): AllowedRead | undefined {
  return ALLOWED_READS.find((read) => read.matches(segments));
}

/**
 * Headers de la API que llegan al navegador. El estado de cuenta (D11 de account-statements) pasa
 * además su nombre de archivo, su longitud y la espera de un 429; las demás lecturas, solo el tipo.
 */
function responseHeaders(upstream: Response, read: AllowedRead, context: RequestContext) {
  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    'Cache-Control': 'no-store',
    'X-Request-Id': upstream.headers.get('X-Request-Id') ?? context.requestId,
  };
  if (read.binary) {
    for (const name of ['Content-Disposition', 'Content-Length', 'Retry-After']) {
      const value = upstream.headers.get(name);
      if (value !== null) headers[name] = value;
    }
  }
  return headers;
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
  const read = allowedRead(segments);
  if (!read) return problemResponse(context, 404, 'NOT_FOUND', 'No encontrado');

  const current = await currentSession();
  if (!current) {
    await endLocalSession();
    return problemResponse(context, 401, 'UNAUTHENTICATED', 'Sesión terminada');
  }

  try {
    const token = await accessTokenFor(current.sessionId, context);
    const url = new URL(`/${segments.join('/')}`, serverEnv().apiBaseUrl);
    url.search = new URL(request.url).search;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        ...forwardHeaders(context),
        Authorization: `Bearer ${token}`,
        Accept: read.binary
          ? 'application/pdf, application/problem+json'
          : 'application/json, application/problem+json',
      },
      cache: 'no-store',
    });
    if (upstream.status === 401) await endLocalSession();
    // Un cuerpo binario pasa tal cual: leerlo como texto corrompería los bytes del PDF.
    return new Response(read.binary ? upstream.body : await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders(upstream, read, context),
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
