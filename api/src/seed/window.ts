import { businessDayOf, startOfBusinessDay } from '../shared/business-day.js';

/**
 * Ventana de los datos de volumen (HIS-10): 12 meses que terminan ayer a las 23:59 de CDMX, así
 * ningún movimiento del seed cae en el día actual (cuyo límite diario quedaría consumido). El
 * fondeo inicial va una hora antes de la ventana.
 */
export function seedWindow(now: Date): { start: Date; end: Date; fundedAt: Date } {
  const end = new Date(startOfBusinessDay(businessDayOf(now)).getTime() - 60_000);
  const start = new Date(end.getTime() - 365 * 86_400_000);
  return { start, end, fundedAt: new Date(start.getTime() - 3_600_000) };
}
