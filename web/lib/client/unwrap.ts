import { ProblemError } from '@devchrisvaz/wallet-contract';
import type { ActionProblem, ActionResult } from '@/lib/action-result';

/**
 * `ProblemError` del contrato construido con el problema que devolvió una Server Action. Conserva
 * el problema original (con `retryAfter`) para la interfaz.
 */
export class ActionProblemError extends ProblemError {
  readonly problem: ActionProblem;
  readonly retryAfter: number | undefined;

  constructor(problem: ActionProblem) {
    super(problem.status, { ...problem });
    this.problem = problem;
    this.retryAfter = problem.retryAfter;
  }
}

/** Resultado de una Server Action: los datos, o lanza el problema como `ProblemError` (D5). */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ActionProblemError(result.problem);
}

/**
 * No sabemos si la operación se hizo: la acción no respondió (red) o el servidor falló con 5xx.
 * Es el único caso que se reintenta, y con la misma llave de idempotencia (WEB-17).
 */
export function isUncertainFailure(error: unknown): boolean {
  if (error instanceof ProblemError) return error.status >= 500;
  return true;
}
