import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import { parseBody } from '../../../../platform/http/validation.js';
import type { CreateTransfer } from '../../application/create-transfer.js';
import { createTransferRequestSchema, parseIdempotencyKey } from './schemas.js';

export interface TransferHandlers {
  readonly createTransfer: CreateTransfer;
}

/** Rutas de transferencias: solo traducen HTTP y delegan en los casos de uso (PLT-18). */
export function transferRoutes(handlers: TransferHandlers, authenticateRequest: RequestHandler) {
  const routes = routeTable(authenticateRequest);

  routes.post('/transfers', async (req, res) => {
    // La llave se valida antes que el cuerpo; ninguna de las dos validaciones la consume (TRF-02).
    const key = parseIdempotencyKey(req.get('Idempotency-Key'));
    const input = parseBody(createTransferRequestSchema, req.body);
    const outcome = await handlers.createTransfer.execute(res.locals.userId as string, key, input);
    switch (outcome.kind) {
      case 'CREATED':
        res.status(201).json(outcome.transfer);
        return;
      case 'REPLAYED':
        res.setHeader('Idempotent-Replayed', 'true');
        res.status(200).json(outcome.transfer);
        return;
      case 'REJECTED':
        if (outcome.replayed) res.setHeader('Idempotent-Replayed', 'true');
        throw outcome.error;
    }
  });

  return routes;
}
