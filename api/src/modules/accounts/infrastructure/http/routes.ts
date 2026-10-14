import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import type { ListAccounts } from '../../application/list-accounts.js';

export interface AccountHandlers {
  readonly listAccounts: ListAccounts;
}

/** Rutas de cuentas: todas exigen access token y filtran por el usuario autenticado. */
export function accountRoutes(handlers: AccountHandlers, authenticateRequest: RequestHandler) {
  const routes = routeTable(authenticateRequest);

  routes.get('/accounts', async (_req, res) => {
    res.status(200).json(await handlers.listAccounts.execute(res.locals.userId as string));
  });

  return routes;
}
