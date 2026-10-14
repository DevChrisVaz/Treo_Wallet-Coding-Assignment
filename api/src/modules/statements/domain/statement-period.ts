import { addDays, businessDayOf, startOfBusinessDay } from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';

/** Mismo patrón que el parámetro `StatementPeriod` del contrato: `YYYY-MM` de 2000 a 2099. */
const PERIOD = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;

export type StatementPeriodErrorCode = 'INVALID_FORMAT' | 'DATE_OUT_OF_RANGE';

/** Periodo inválido; `code` pertenece al vocabulario `FieldErrorCode` del contrato. */
export class StatementPeriodError extends Error {
  constructor(
    readonly code: StatementPeriodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StatementPeriodError';
  }
}

/** Primer día (`YYYY-MM-01`) del mes siguiente a `YYYY-MM`. */
function firstDayOfNextMonth(value: string): string {
  const [year, month] = value.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/**
 * Mes calendario de la Ciudad de México de un estado de cuenta (HIS-11, D8). Va de la medianoche
 * de CDMX del día 1 a la del día 1 del mes siguiente; el mes en curso es parcial y llega hasta el
 * instante de generación. Las medianoches se convierten a UTC con la misma función que el filtro
 * de días del historial (HIS-06), que usa la base IANA: los meses anteriores a 2023, con horario de
 * verano, quedan bien.
 */
export class StatementPeriod {
  private constructor(
    /** `YYYY-MM`. */
    readonly value: string,
    /** Instante en que se genera el documento: el único momento que se lee del reloj. */
    readonly generatedAt: Date,
    /** Inicio inclusivo en UTC. */
    readonly start: Date,
    /** Fin exclusivo en UTC. */
    readonly endExclusive: Date,
    readonly partial: boolean,
    /** Primer y último día (`YYYY-MM-DD`) que cubre el documento. */
    readonly firstDay: string,
    readonly lastDay: string,
  ) {}

  /**
   * Valida el patrón y que el mes no sea posterior al mes en curso de CDMX. Sin límite inferior
   * aparte del patrón: un mes anterior a la apertura de la cuenta es un estado vacío.
   */
  static parse(value: string, clock: Clock): StatementPeriod {
    if (!PERIOD.test(value)) {
      throw new StatementPeriodError(
        'INVALID_FORMAT',
        'El periodo debe ser un mes AAAA-MM entre 2000 y 2099',
      );
    }
    const generatedAt = clock.now();
    const today = businessDayOf(generatedAt);
    const currentMonth = today.slice(0, 7);
    // Los meses `YYYY-MM` válidos se comparan bien como texto.
    if (value > currentMonth) {
      throw new StatementPeriodError('DATE_OUT_OF_RANGE', 'El periodo no puede ser un mes futuro');
    }
    const firstDay = `${value}-01`;
    const nextMonth = firstDayOfNextMonth(value);
    const start = startOfBusinessDay(firstDay);
    if (value === currentMonth) {
      // Hasta el instante de generación, inclusive: los asientos llevan la hora del Clock, con
      // milisegundos, así que uno del mismo instante queda dentro.
      const endExclusive = new Date(generatedAt.getTime() + 1);
      return new StatementPeriod(value, generatedAt, start, endExclusive, true, firstDay, today);
    }
    return new StatementPeriod(
      value,
      generatedAt,
      start,
      startOfBusinessDay(nextMonth),
      false,
      firstDay,
      addDays(nextMonth, -1),
    );
  }
}
