import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** El contrato se resuelve desde el paquete instalado; no hay copias locales (PLT-11). */
const contractPath = createRequire(import.meta.url).resolve(
  '@devchrisvaz/wallet-contract/openapi.yaml',
);

/**
 * `GET /docs` (Swagger UI) y `GET /openapi.yaml`, solo fuera de producción. En producción el
 * router queda vacío y ambas rutas caen en el 404 general.
 */
export function docsRouter(options: { readonly nodeEnv: string }): Router {
  const router = Router();
  if (options.nodeEnv === 'production') return router;

  const yaml = readFileSync(contractPath, 'utf8');
  const document = parse(yaml) as Record<string, unknown>;

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(yaml);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'Wallet API' }),
  );
  return router;
}
