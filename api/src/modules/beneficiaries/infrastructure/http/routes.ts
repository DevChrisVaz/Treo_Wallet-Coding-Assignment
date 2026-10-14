import type { Beneficiary } from '@devchrisvaz/wallet-contract';
import type { RequestHandler } from 'express';
import { currentRequestContext } from '../../../../platform/context/request-context.js';
import { routeTable } from '../../../../platform/http/auth.js';
import { rateLimit } from '../../../../platform/http/rate-limit.js';
import { parseBody } from '../../../../platform/http/validation.js';
import type { Clock } from '../../../../shared/clock.js';
import type {
  BeneficiaryRecord,
  BeneficiaryStore,
  CreateBeneficiary,
} from '../../application/create-beneficiary.js';
import { createBeneficiaryRequestSchema } from './schemas.js';

export interface BeneficiaryHandlers {
  readonly createBeneficiary: CreateBeneficiary;
  readonly beneficiaries: BeneficiaryStore;
}

function toView(record: BeneficiaryRecord): Beneficiary {
  return {
    id: record.id,
    name: record.name,
    alias: record.alias,
    clabe: record.clabe,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Rutas de beneficiarios (BEN-01, BEN-09, BEN-10): protegidas y filtradas por el usuario. */
export function beneficiaryRoutes(
  handlers: BeneficiaryHandlers,
  authenticateRequest: RequestHandler,
  clock: Clock,
) {
  const routes = routeTable(authenticateRequest);
  // 10 intentos de alta por hora por usuario, para frenar la enumeración de CLABEs (BEN-10).
  const createLimit = rateLimit({
    name: 'beneficiary-create',
    windowMs: 60 * 60_000,
    limit: 10,
    key: () => currentRequestContext()?.userId ?? 'anonimo',
    clock,
  });

  routes.get('/beneficiaries', async (_req, res) => {
    const records = await handlers.beneficiaries.listByUser(res.locals.userId as string);
    res.status(200).json({ items: records.map(toView) });
  });

  routes.post('/beneficiaries', createLimit, async (req, res) => {
    const input = parseBody(createBeneficiaryRequestSchema, req.body);
    const result = await handlers.createBeneficiary.execute(res.locals.userId as string, input);
    res.status(result.created ? 201 : 200).json(toView(result.beneficiary));
  });

  return routes;
}
