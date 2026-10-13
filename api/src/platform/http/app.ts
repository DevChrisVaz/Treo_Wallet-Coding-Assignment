import express, { type Express, type Router } from 'express';
import type { AppLogger } from '../../shared/logger.js';
import { requestContext } from './request-id.js';
import { requestLogger } from './request-logger.js';

export interface HttpAppOptions {
  /** Valores para `trust proxy` (PLT-07). */
  readonly trustedProxies: readonly string[];
  /** Routers de los módulos; solo traducen HTTP y delegan en casos de uso (PLT-18). */
  readonly routers: readonly Router[];
  readonly logger?: AppLogger;
}

/** Arma la aplicación Express con los middlewares transversales de la plataforma. */
export function createHttpApp(options: HttpAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  if (options.logger) app.use(requestLogger(options.logger));
  for (const router of options.routers) app.use(router);
  return app;
}
