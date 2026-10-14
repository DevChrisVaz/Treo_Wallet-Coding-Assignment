import { addDays, businessDayOf } from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';
import type { FieldError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { TransferKind } from './ledger.js';

/** Días que se puede programar una transferencia a partir de hoy (TRF-27). */
export const MAX_SCHEDULE_DAYS = 90;

/** Programadas activas por usuario: SCHEDULED y programadas en PENDING_OTP vigentes (TRF-29). */
export const MAX_ACTIVE_SCHEDULED = 20;

/**
 * Rango programable (TRF-27, D4): de mañana a 90 días después de hoy, ambos inclusive, en días de
 * la Ciudad de México. "Hoy" sale del `Clock` con la misma función que el día del límite diario.
 */
export function schedulableRange(clock: Clock): { readonly min: string; readonly max: string } {
  const today = businessDayOf(clock.now());
  return { min: addDays(today, 1), max: addDays(today, MAX_SCHEDULE_DAYS) };
}

/**
 * `DATE_OUT_OF_RANGE` en `/scheduledFor` si la fecha (`YYYY-MM-DD`, ya válida en el calendario) no
 * está en el rango programable. Hoy también queda fuera.
 */
export function scheduledDateIssue(day: string, clock: Clock): FieldError | null {
  const { min, max } = schedulableRange(clock);
  // Las fechas `YYYY-MM-DD` válidas se comparan bien como texto.
  if (day >= min && day <= max) return null;
  return {
    pointer: '/scheduledFor',
    code: 'DATE_OUT_OF_RANGE',
    message: `Elige una fecha entre mañana y ${MAX_SCHEDULE_DAYS} días después de hoy`,
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
