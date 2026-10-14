/** Indica si la fecha existe en el calendario gregoriano (considera años bisiestos). */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= daysInMonth;
}

/** Zona horaria de negocio: los días calendario del contrato son de la Ciudad de México. */
export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';

/** Días que se puede programar una transferencia a partir de hoy (CTR-18). */
export const MAX_SCHEDULE_DAYS = 90;

// Se crea al primer uso y no al importar: así el paquete carga aunque un motor no tenga la zona
// horaria (CTR-15); solo fallaría quien llame a estas funciones.
let mexicoCityParts: Intl.DateTimeFormat | undefined;

function mexicoCityFormat(): Intl.DateTimeFormat {
  mexicoCityParts ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return mexicoCityParts;
}

/**
 * Fecha calendario (`YYYY-MM-DD`) del instante en la Ciudad de México. Recibe el instante en lugar de
 * leer el reloj, para que el consumidor decida qué hora usar y las pruebas no dependan de él.
 */
export function mexicoCityDate(instant: Date): string {
  const parts = mexicoCityFormat().formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Suma días a una fecha calendario con aritmética UTC, sin pasar por horas locales. */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Rango programable a partir del instante: de mañana a 90 días después de hoy, ambos inclusive. */
export function schedulableRange(instant: Date): { min: string; max: string } {
  const today = mexicoCityDate(instant);
  return { min: addDays(today, 1), max: addDays(today, MAX_SCHEDULE_DAYS) };
}
