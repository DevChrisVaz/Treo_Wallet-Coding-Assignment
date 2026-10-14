import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import type { GetAccount } from '../../application/get-account.js';
import type { ListAccounts } from '../../application/list-accounts.js';

export interface AccountHandlers {
  readonly listAccounts: ListAccounts;
  readonly getAccount: GetAccount;
}

/** Rutas de cuentas: todas exigen access token y filtran por el usuario autenticado. */
export function accountRoutes(handlers: AccountHandlers, authenticateRequest: RequestHandler) {
  const routes = routeTable(authenticateRequest);

  routes.get('/accounts', async (_req, res) => {
    res.status(200).json(await handlers.listAccounts.execute(res.locals.userId as string));
  });

  routes.get('/accounts/:accountId', async (req, res) => {
    const account = await handlers.getAccount.execute(
      res.locals.userId as string,
      String(req.params.accountId),
    );
    res.status(200).json(account);
  });

  return routes;
}
