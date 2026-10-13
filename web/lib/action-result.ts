import type { FieldError, ProblemCode, TransferStatus } from '@devchrisvaz/wallet-contract';

/**
 * Problema que una Server Action devuelve al navegador: los campos del `Problem` del contrato que
 * la interfaz usa, más `retryAfter` (segundos de `Retry-After` en un `429`). Es un objeto plano y
 * serializable; nunca lleva mensajes internos, trazas ni datos de la sesión (WEB-08).
 */
export interface ActionProblem {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  requestId: string;
  detail?: string;
  errors?: FieldError[];
  transferId?: string;
  transferStatus?: TransferStatus;
  remaining?: string;
  attemptsRemaining?: number;
  retryAfter?: number;
}

/** Resultado de una Server Action como valor (D5 de web-app): nunca lanza errores esperados. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; problem: ActionProblem };
