import type { RequestHandler } from 'express';
import { routeTable } from '../../../../platform/http/auth.js';
import { byUser, rateLimit } from '../../../../platform/http/rate-limit.js';
import { parseBody } from '../../../../platform/http/validation.js';
import type { AppConfig } from '../../../../platform/config/config.js';
import type { Clock } from '../../../../shared/clock.js';
import type { CancelTransfer } from '../../application/cancel-transfer.js';
import type { ConfirmTransfer } from '../../application/confirm-transfer.js';
import type { CreateTransfer } from '../../application/create-transfer.js';
import type { GetTransfer } from '../../application/get-transfer.js';
import type { ListScheduledTransfers } from '../../application/list-scheduled-transfers.js';
import type { ResendTransferOtp } from '../../application/resend-transfer-otp.js';
import {
  confirmTransferRequestSchema,
  createTransferRequestSchema,
  parseIdempotencyKey,
} from './schemas.js';

export interface TransferHandlers {
  readonly createTransfer: CreateTransfer;
  readonly confirmTransfer: ConfirmTransfer;
  readonly resendTransferOtp: ResendTransferOtp;
  readonly getTransfer: GetTransfer;
  readonly cancelTransfer: CancelTransfer;
  readonly listScheduledTransfers: ListScheduledTransfers;
}

/** Rutas de transferencias: solo traducen HTTP y delegan en los casos de uso (PLT-18). */
const MINUTE = 60_000;

export function transferRoutes(
  handlers: TransferHandlers,
  authenticateRequest: RequestHandler,
  clock: Clock,
  limits: Pick<
    AppConfig['rateLimits'],
    'transferCreateMax' | 'transferConfirmMax' | 'transferResendMax' | 'transferCancelMax'
  >,
) {
  const routes = routeTable(authenticateRequest);
  // Por usuario (TRF-37): después de autenticar y antes de validar. Una repetición de la misma
  // llave de idempotencia también cuenta; el margen está en los topes, no en una excepción.
  const perUser = (name: string, windowMinutes: number, limit: number) =>
    rateLimit({ name, windowMs: windowMinutes * MINUTE, limit, key: byUser, clock });
  const createLimit = perUser('transfer-create', 10, limits.transferCreateMax);
  const confirmLimit = perUser('transfer-confirm', 15, limits.transferConfirmMax);
  const resendLimit = perUser('transfer-resend', 15, limits.transferResendMax);
  const cancelLimit = perUser('transfer-cancel', 10, limits.transferCancelMax);

  routes.post('/transfers', createLimit, async (req, res) => {
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

  // Antes de `/transfers/:transferId`: si no, Express toma "scheduled" como un id (404).
  routes.get('/transfers/scheduled', async (_req, res) => {
    const list = await handlers.listScheduledTransfers.execute(res.locals.userId as string);
    res.status(200).json(list);
  });

  routes.get('/transfers/:transferId', async (req, res) => {
    const transfer = await handlers.getTransfer.execute(
      res.locals.userId as string,
      String(req.params.transferId),
    );
    res.status(200).json(transfer);
  });

  routes.post('/transfers/:transferId/confirm', confirmLimit, async (req, res) => {
    const input = parseBody(confirmTransferRequestSchema, req.body);
    const transfer = await handlers.confirmTransfer.execute(
      res.locals.userId as string,
      String(req.params.transferId),
      input.otp,
    );
    res.status(200).json(transfer);
  });

  routes.post('/transfers/:transferId/otp/resend', resendLimit, async (req, res) => {
    const challenge = await handlers.resendTransferOtp.execute(
      res.locals.userId as string,
      String(req.params.transferId),
    );
    res.status(202).json(challenge);
  });

  routes.post('/transfers/:transferId/cancel', cancelLimit, async (req, res) => {
    const transfer = await handlers.cancelTransfer.execute(
      res.locals.userId as string,
      String(req.params.transferId),
    );
    res.status(200).json(transfer);
  });

  return routes;
}
