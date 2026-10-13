/**
 * Día de negocio (TRF-12, ACC-11, HIS-06): el día calendario de la Ciudad de México. Es una
 * constante del dominio, no configuración. Los cálculos usan la base de zonas horarias de `Intl`,
 * así que siguen siendo correctos si la zona vuelve a tener horario de verano.
 */
export const BUSINESS_TIME_ZONE = 'America/Mexico_City';

const DAY_MS = 86_400_000;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Hora de pared en CDMX de un instante, expresada como si fuera UTC (para restar offsets). */
function wallClock(epochMs: number): { day: string; asUtcMs: number } {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(epochMs)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const [y, m, d] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    asUtcMs: Date.UTC(y, m - 1, d, Number(parts.hour), Number(parts.minute), Number(parts.second)),
  };
}

/** `YYYY-MM-DD` del día de CDMX en que cae el instante. */
export function businessDayOf(instant: Date): string {
  return wallClock(instant.getTime()).day;
}

/** Instante UTC de la medianoche de CDMX con que empieza `day` (`YYYY-MM-DD`). */
export function startOfBusinessDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  let guess = target;
  // Dos iteraciones bastan: el offset se recalcula en el instante resultante.
  for (let i = 0; i < 2; i += 1) {
    const offset = wallClock(guess).asUtcMs - guess;
    guess = target - offset;
  }
  return new Date(guess);
}

/** El día siguiente a `day`, en el calendario (sin zonas horarias). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Siguiente medianoche de CDMX después del instante, en UTC (`resetsAt` del límite diario). */
export function nextBusinessDayStart(instant: Date): Date {
  return startOfBusinessDay(addDays(businessDayOf(instant), 1));
}

/** Rango UTC `[from 00:00, (to + 1) 00:00)` de un intervalo inclusivo de días de CDMX. */
export function utcRangeOfDays(from: string, to: string): { start: Date; endExclusive: Date } {
  return { start: startOfBusinessDay(from), endExclusive: startOfBusinessDay(addDays(to, 1)) };
}
