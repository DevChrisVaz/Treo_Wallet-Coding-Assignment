'use server';

import type { Transfer } from '@devchrisvaz/wallet-contract';
import * as z from 'zod';
import type { ActionResult } from '@/lib/action-result';
import { sessionAction } from '@/lib/server/action';

/*
 * Mutaciones de las transferencias programadas (WEB-34, D11 de scheduled-transfers). Siguen el
 * envoltorio común de las Server Actions (WEB-06 a WEB-08): Next.js compara Origin con Host, la
 * entrada se valida antes de exigir la sesión y el resultado vuelve como valor.
 */

const cancelForm = z.strictObject({ transferId: z.uuid() });

/**
 * Cancela una transferencia `SCHEDULED` (`cancelTransfer`) en una sola llamada a la API. La API
 * responde `200` también si ya estaba `CANCELLED`, y `409 TRANSFER_NOT_CANCELLABLE` con
 * `transferStatus` si ya se ejecutó o cambió de estado; ese problema llega tal cual al navegador.
 */
export async function cancelTransfer(input: unknown): Promise<ActionResult<Transfer>> {
  return sessionAction(cancelForm, input, async ({ data, api }) => {
    const { data: transfer } = await api.POST('/transfers/{transferId}/cancel', {
      params: { path: { transferId: data.transferId } },
    });
    if (!transfer) throw new Error('cancelTransfer respondió sin transferencia');
    return transfer;
  });
}
