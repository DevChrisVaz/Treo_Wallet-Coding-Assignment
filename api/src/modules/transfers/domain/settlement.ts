import type { Money } from '../../../shared/money.js';

/** Motivo por el que una transferencia no se ejecuta: rechazo al crear o falla después. */
export type DeclineReason = 'INSUFFICIENT_FUNDS' | 'DAILY_LIMIT_EXCEEDED';

export interface Decline {
  readonly reason: DeclineReason;
  /** En el límite, lo que queda del día; nulo por saldo. */
  readonly remaining: Money | null;
}

/**
 * Validación de una transferencia cuyas cuentas y contador ya están bloqueados (TRF-10, TRF-11,
 * TRF-16, TRF-30): el saldo leído bajo bloqueo y, si hay contador (a terceros), el uso del día de
 * ese contador. La misma regla para crear, confirmar y ejecutar una programada (D6). Llegar
 * exactamente al límite o al saldo pasa.
 */
export function declineFor(input: {
  readonly balance: Money;
  readonly amount: Money;
  readonly usage: { readonly used: Money; readonly limit: Money } | null;
}): Decline | null {
  if (input.balance.isLessThan(input.amount)) {
    return { reason: 'INSUFFICIENT_FUNDS', remaining: null };
  }
  if (input.usage && input.usage.used.plus(input.amount).isGreaterThan(input.usage.limit)) {
    return { reason: 'DAILY_LIMIT_EXCEEDED', remaining: input.usage.limit.minus(input.usage.used) };
  }
  return null;
}
