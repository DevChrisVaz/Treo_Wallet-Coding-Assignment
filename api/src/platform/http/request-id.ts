import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithRequestContext } from '../context/request-context.js';

/** Solo se reutiliza un identificador seguro para escribirse en logs (sin inyección de líneas). */
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function resolveRequestId(header: string | undefined): string {
  return header !== undefined && VALID_REQUEST_ID.test(header) ? header : randomUUID();
}

/**
 * Asigna el identificador de la petición (PLT-05): reutiliza `X-Request-Id` si es válido o genera
 * uno, lo devuelve siempre en la respuesta y abre el contexto de la petición para el resto de la
 * cadena de middlewares.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = resolveRequestId(req.get('X-Request-Id'));
  res.setHeader('X-Request-Id', requestId);
  runWithRequestContext({ requestId, ip: req.ip, userAgent: req.get('User-Agent') }, () => next());
};
