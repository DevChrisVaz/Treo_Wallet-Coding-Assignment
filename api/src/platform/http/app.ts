import express, { type Express, type RequestHandler, type Router } from 'express';
import type { DomainError } from '../../shared/errors.js';
import type { AppLogger } from '../../shared/logger.js';
import { errorHandler, notFoundHandler } from './error-handler.js';
import { requestContext } from './request-id.js';
import { requestLogger } from './request-logger.js';

export interface HttpAppOptions {
  /** Valores para `trust proxy` (PLT-07). */
  readonly trustedProxies: readonly string[];
  /** Routers de los módulos; solo traducen HTTP y delegan en casos de uso (PLT-18). */
  readonly routers: readonly Router[];
  readonly logger: AppLogger;
  /** Traduce errores de infraestructura (p. ej. de PostgreSQL) a errores de dominio (PLT-04). */
  readonly translateError?: (error: unknown) => DomainError | undefined;
}

/** La documentación navegable no existe en producción (PLT-11) y se sirve mejor con su caché. */
const DOCUMENTATION = /^\/(docs(\/|$)|openapi\.yaml$)/;

/**
 * `Cache-Control: no-store` en toda respuesta (PLT-20): al inicio de la cadena, así que también lo
 * llevan los problem+json, los 404 y los 429. Una ruta que necesite otra cosa lo sobrescribe.
 */
export const noStore: RequestHandler = (req, res, next) => {
  if (!DOCUMENTATION.test(req.path)) res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Arma la aplicación Express con los middlewares transversales de la plataforma. */
export function createHttpApp(options: HttpAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  // X-Forwarded-For solo cuenta si la conexión viene de un proxy de confianza (BFF o ALB); la IP
  // resultante es la que usan el rate limiting y la auditoría (PLT-07).
  app.set('trust proxy', [...options.trustedProxies]);
  app.use(noStore);
  app.use(requestContext);
  app.use(requestLogger(options.logger));
  // Solo objetos y arreglos JSON, con un tamaño acotado; lo demás es 400 MALFORMED_REQUEST.
  app.use(express.json({ limit: '16kb', strict: true }));
  for (const router of options.routers) app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler(options.logger, options.translateError));
  return app;
}
