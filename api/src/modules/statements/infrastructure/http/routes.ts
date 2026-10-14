import type { RequestHandler } from 'express';
import { currentRequestContext } from '../../../../platform/context/request-context.js';
import { routeTable } from '../../../../platform/http/auth.js';
import { rateLimit } from '../../../../platform/http/rate-limit.js';
import type { Clock } from '../../../../shared/clock.js';
import type { GenerateStatement } from '../../application/generate-statement.js';

export interface StatementHandlers {
  readonly generateStatement: GenerateStatement;
}

/**
 * Estado de cuenta en PDF (HIS-11, D9). Exige access token; el límite de 10 por minuto es por
 * usuario (llave `statement:<userId>`), así que se aplica después de autenticar y cuenta también
 * las peticiones rechazadas.
 */
export function statementRoutes(
  handlers: StatementHandlers,
  authenticateRequest: RequestHandler,
  clock: Clock,
) {
  const routes = routeTable(authenticateRequest);
  const statementLimit = rateLimit({
    name: 'statement',
    windowMs: 60_000,
    limit: 10,
    key: () => currentRequestContext()?.userId ?? 'anonimo',
    clock,
  });

  // Express responde HEAD con el handler de GET: generaría el documento y registraría una
  // exportación sin entregarla (AUD-07). Solo se admite GET.
  const onlyGet: RequestHandler = (req, res, next) => {
    if (req.method === 'HEAD') {
      res.status(405).set('Allow', 'GET').end();
      return;
    }
    next();
  };

  routes.get(
    '/accounts/:accountId/statements/:period',
    onlyGet,
    statementLimit,
    async (req, res) => {
      const statement = await handlers.generateStatement.execute(
        res.locals.userId as string,
        String(req.params.accountId),
        String(req.params.period),
      );
      // `end` y no `send`: sin ETag (la respuesta no se guarda) y con los bytes tal cual.
      res
        .status(200)
        .set({
          'Content-Type': 'application/pdf',
          'Content-Length': String(statement.bytes.length),
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="${statement.filename}"`,
        })
        .end(statement.bytes);
    },
  );

  return routes;
}
