import 'server-only';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';

/** Datos de la petición del navegador que se propagan a la API (D7 de web-app, WEB-10). */
export interface RequestContext {
  requestId: string;
  clientIp: string;
}

export interface HeaderReader {
  get(name: string): string | null;
}

/** Un request id ajeno solo se reutiliza si es corto y sin caracteres que ensucien los logs. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const LOOPBACK = '127.0.0.1';

/**
 * La IP del cliente es la última de `X-Forwarded-For`: la que agrega el proxy inmediatamente
 * delante de la web (el ALB en AWS). Next.js solo llena el header con la dirección del socket si
 * no viene; sin proxy, en local, se usa la de loopback.
 */
function clientIpFrom(forwardedFor: string | null): string {
  const last = forwardedFor?.split(',').at(-1)?.trim();
  return last && isIP(last) !== 0 ? last : LOOPBACK;
}

export function requestContextFrom(source: HeaderReader): RequestContext {
  const incoming = source.get('x-request-id');
  return {
    requestId: incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID(),
    clientIp: clientIpFrom(source.get('x-forwarded-for')),
  };
}

/** Contexto de la petición en curso (Server Action o route handler). */
export async function getRequestContext(): Promise<RequestContext> {
  return requestContextFrom(await headers());
}

/** Headers que acompañan cada llamada a la API. */
export function forwardHeaders(context: RequestContext): Record<string, string> {
  return {
    'X-Request-Id': context.requestId,
    'X-Forwarded-For': context.clientIp,
  };
}
