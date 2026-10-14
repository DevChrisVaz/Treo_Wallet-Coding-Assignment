import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import { parseInput } from '../../../../platform/http/validation.js';
import type { ListMovements } from '../../application/list-movements.js';
import { movementQuerySchema } from './schemas.js';

export interface MovementHandlers {
  readonly listMovements: ListMovements;
}

/** Historial de movimientos: exige access token y solo muestra cuentas del usuario (HIS-01). */
export function movementRoutes(handlers: MovementHandlers, authenticateRequest: RequestHandler) {
  const routes = routeTable(authenticateRequest);

  routes.get('/accounts/:accountId/movements', async (req, res) => {
    const query = parseInput(movementQuerySchema, req.query);
    const page = await handlers.listMovements.execute(
      res.locals.userId as string,
      String(req.params.accountId),
      query,
    );
    res.status(200).json(page);
  });

  return routes;
}
