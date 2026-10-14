import { addFieldIssue, textField, type FieldContext } from './field-errors';

/** Indica si la fecha existe en el calendario gregoriano (considera años bisiestos). */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= daysInMonth;
}

/** Zona horaria de negocio: los días calendario del contrato son de la Ciudad de México. */
export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';

/** Días máximos hacia adelante para programar una transferencia (CTR-18, TRF-27). */
export const MAX_SCHEDULE_DAYS = 90;

/** Minutos mínimos de anticipación para programar una transferencia (TRF-27). */
export const MIN_SCHEDULE_MINUTES = 10;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

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

/**
 * Ventana programable a partir del instante: de 10 minutos a 90 días después, ambos inclusive
 * (TRF-27). Son instantes exactos; México no tiene horario de verano desde 2022, pero se suman
 * milisegundos y no días locales, así que la regla no depende de eso.
 */
export function schedulableWindow(instant: Date): { min: Date; max: Date } {
  return {
    min: new Date(instant.getTime() + MIN_SCHEDULE_MINUTES * MINUTE_MS),
    max: new Date(instant.getTime() + MAX_SCHEDULE_DAYS * DAY_MS),
  };
}

/**
 * Fechas calendario (`YYYY-MM-DD`, Ciudad de México) que contienen la ventana programable: sirven
 * como `min` y `max` de un `<input type="date">`. La hora se valida aparte con `transferFormAt`.
 */
export function schedulableDates(instant: Date): { min: string; max: string } {
  const window = schedulableWindow(instant);
  return { min: mexicoCityDate(window.min), max: mexicoCityDate(window.max) };
}

const INSTANT =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-]([0-9]{2}):([0-9]{2}))$/;

/**
 * Interpreta un instante RFC 3339 con desfase (`2026-10-20T14:30:00-06:00` o `...Z`). Devuelve `null`
 * si no tiene esa forma o si el día o la hora no existen.
 */
export function parseInstant(value: string): Date | null {
  const match = INSTANT.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, sec, , , offH, offM] = match;
  if (!isValidCalendarDate(Number(y), Number(mo), Number(d))) return null;
  if (Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59) return null;
  if (offH !== undefined && (Number(offH) > 23 || Number(offM) > 59)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

/** Indica si el texto RFC 3339 tiene segundos y fracción en cero (precisión de minuto). */
function hasMinutePrecision(value: string): boolean {
  const match = INSTANT.exec(value);
  return match !== null && match[6] === '00' && /^0*$/.test(match[7] ?? '');
}

/** Revisa forma, existencia y precisión de minuto de un instante; reporta el error y dice si pasó. */
function checkInstant(value: string, ctx: FieldContext): Date | null {
  const instant = parseInstant(value);
  if (!instant) {
    addFieldIssue(
      ctx,
      'INVALID_FORMAT',
      'Escribe fecha y hora válidas, con el desfase horario (por ejemplo 2026-10-20T14:30:00-06:00)',
    );
    return null;
  }
  if (!hasMinutePrecision(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'La hora debe ser en minutos exactos, sin segundos');
    return null;
  }
  return instant;
}

/** Instante de ejecución (`ScheduledInstant`): RFC 3339 con desfase y precisión de minuto. */
export const scheduledInstant = textField('La fecha y hora son obligatorias', (value, ctx) => {
  checkInstant(value, ctx);
});

/**
 * Instante programado dentro de la ventana del momento dado: de 10 minutos a 90 días después
 * (`DATE_OUT_OF_RANGE` si queda fuera).
 */
export function scheduledInstantWithin(now: Date) {
  const { min, max } = schedulableWindow(now);
  return textField('La fecha y hora son obligatorias', (value, ctx) => {
    const instant = checkInstant(value, ctx);
    if (!instant) return;
    if (instant < min || instant > max) {
      addFieldIssue(
        ctx,
        'DATE_OUT_OF_RANGE',
        'Elige un momento entre 10 minutos y 90 días después de ahora',
      );
    }
  });
}
