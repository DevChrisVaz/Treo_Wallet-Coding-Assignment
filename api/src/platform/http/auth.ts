import { Router, type RequestHandler } from 'express';
import type { Clock } from '../../shared/clock.js';
import { DomainError } from '../../shared/errors.js';
import { currentRequestContext } from '../context/request-context.js';

/** Verifica un access token y devuelve el usuario; lanza si no es válido (IDN-09). */
export interface AccessTokenVerifier {
  verify(token: string, now: Date): Promise<{ readonly userId: string }>;
}

/**
 * Rutas que no piden token (IDN-10). Además de éstas, la plataforma sirve `GET /health`,
 * `GET /docs` y `GET /openapi.yaml`, que no pasan por la tabla de rutas de los módulos.
 */
export const PUBLIC_ROUTE_PATTERNS: readonly RegExp[] = [
  /^GET \/health$/,
  /^POST \/auth\/.+$/,
  /^GET \/docs(\/.*)?$/,
  /^GET \/openapi\.yaml$/,
];

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/**
 * Exige `Authorization: Bearer <access token>` válido. Deja el usuario en el contexto de la
 * petición (lo leen el log y la auditoría) y en `res.locals.userId`.
 */
export function authenticate(verifier: AccessTokenVerifier, clock: Clock): RequestHandler {
  return async (req, res, next) => {
    const match = BEARER.exec(req.get('Authorization') ?? '');
    if (!match?.[1]) throw new DomainError('UNAUTHENTICATED', 'Falta un access token válido');
    let userId: string;
    try {
      ({ userId } = await verifier.verify(match[1], clock.now()));
    } catch {
      throw new DomainError('UNAUTHENTICATED', 'El access token no es válido o ya venció');
    }
    const context = currentRequestContext();
    if (context) context.userId = userId;
    res.locals.userId = userId;
    next();
  };
}

export interface RouteInfo {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly public: boolean;
}

/**
 * Tabla de rutas de un módulo con protección por defecto (IDN-10): toda ruta registrada con
 * `get`/`post` pasa primero por `authenticate`; una ruta pública debe declararse explícitamente con
 * `public.get`/`public.post`. Las rutas que no existen siguen respondiendo 404.
 */
export function routeTable(authenticateRequest: RequestHandler) {
  const router = Router();
  const table: RouteInfo[] = [];
  const add =
    (method: 'GET' | 'POST', isPublic: boolean) =>
    (path: string, ...handlers: RequestHandler[]) => {
      table.push({ method, path, public: isPublic });
      const chain = isPublic ? handlers : [authenticateRequest, ...handlers];
      if (method === 'GET') router.get(path, ...chain);
      else router.post(path, ...chain);
    };
  return {
    router,
    table,
    get: add('GET', false),
    post: add('POST', false),
    public: { get: add('GET', true), post: add('POST', true) },
  };
}

/** Falla al arrancar si alguna ruta pública no está en la lista permitida. */
export function assertPublicRoutesAllowed(table: readonly RouteInfo[]): void {
  for (const route of table) {
    const key = `${route.method} ${route.path}`;
    if (route.public && !PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(key))) {
      throw new Error(`La ruta ${key} no puede ser pública`);
    }
  }
}
