import {
  MAX_SCHEDULE_DAYS,
  MIN_SCHEDULE_MINUTES,
  schedulableWindow,
} from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import type { FieldError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { TransferKind } from './ledger.js';

export { MAX_SCHEDULE_DAYS, MIN_SCHEDULE_MINUTES };

/** Programadas activas por usuario: SCHEDULED y programadas en PENDING_OTP vigentes (TRF-29). */
export const MAX_ACTIVE_SCHEDULED = 20;

/**
 * `DATE_OUT_OF_RANGE` en `/scheduledFor` si el instante (ya con forma y precisión de minuto válidas)
 * no cae en la ventana programable (TRF-27): de 10 minutos a 90 días después de ahora, ambos
 * inclusive. La ventana es la del contrato (`schedulableWindow`), con "ahora" del `Clock`.
 */
export function scheduledInstantIssue(instant: Date, clock: Clock): FieldError | null {
  const { min, max } = schedulableWindow(clock.now());
  if (instant >= min && instant <= max) return null;
  return {
    pointer: '/scheduledFor',
    code: 'DATE_OUT_OF_RANGE',
    message: `Elige un momento entre ${MIN_SCHEDULE_MINUTES} minutos y ${MAX_SCHEDULE_DAYS} días después de ahora`,
  };
}

/**
 * `TOO_LARGE` en `/amount` si una programada a un tercero supera el límite diario (TRF-27): nunca
 * podría ejecutarse, porque al ejecutarla se valida el límite de ese día. Entre cuentas propias el
 * límite no aplica.
 */
export function scheduledAmountIssue(
  kind: Exclude<TransferKind, 'FUNDING'>,
  amount: Money,
  dailyLimit: Money,
): FieldError | null {
  if (kind !== 'THIRD_PARTY' || !amount.isGreaterThan(dailyLimit)) return null;
  return {
    pointer: '/amount',
    code: 'TOO_LARGE',
    message: `Una transferencia programada a un tercero no puede superar el límite diario de ${dailyLimit.toDisplayString()}`,
  };
}
