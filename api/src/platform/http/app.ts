import express, { type Express, type Router } from 'express';
import { requestContext } from './request-id.js';

export interface HttpAppOptions {
  /** Valores para `trust proxy` (PLT-07). */
  readonly trustedProxies: readonly string[];
  /** Routers de los módulos; solo traducen HTTP y delegan en casos de uso (PLT-18). */
  readonly routers: readonly Router[];
}

/** Arma la aplicación Express con los middlewares transversales de la plataforma. */
export function createHttpApp(options: HttpAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  for (const router of options.routers) app.use(router);
  return app;
}
