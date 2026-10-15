import { isValidCalendarDate, MEXICO_CITY_TIME_ZONE, mexicoCityDate } from './validators/dates';

// Auxiliares de calendario en America/Mexico_City que comparten la web y la app (TRF-27, HIS-11).
// Reciben el instante en lugar de leer el reloj. Se resuelven con `Intl` y la zona IANA, sin una
// tabla de desfases: México no tiene horario de verano desde el 30 de octubre de 2022 (UTC-6 fijo),
// pero las fechas anteriores siguen dando el desfase que tenían.

let mexicoCityClockParts: Intl.DateTimeFormat | undefined;

// Se crea al primer uso, igual que en `dates.ts` (CTR-15).
function mexicoCityClock(): Intl.DateTimeFormat {
  mexicoCityClockParts ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return mexicoCityClockParts;
}

function toDate(instant: Date | string): Date {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Instante inválido: "${String(instant)}"`);
  return date;
}

/** Fecha (`YYYY-MM-DD`) y hora (`HH:mm`, 24 horas) del instante en la Ciudad de México. */
export function mexicoCityDateTime(instant: Date | string): { date: string; time: string } {
  const parts = mexicoCityClock().formatToParts(toDate(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

const DATE_ONLY = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const TIME_ONLY = /^([0-9]{2}):([0-9]{2})$/;

/**
 * Combina una fecha (`YYYY-MM-DD`) y una hora (`HH:mm`) de la Ciudad de México en el instante ISO
 * UTC que el contrato espera en `scheduledFor` (`2026-10-20T20:30:00.000Z`). Lanza `RangeError` si la
 * fecha o la hora no existen; el formulario debe revisar que ambas estén completas antes.
 */
export function mexicoCityToInstant(date: string, time: string): string {
  const dateMatch = DATE_ONLY.exec(date);
  const timeMatch = TIME_ONLY.exec(time);
  if (!dateMatch || !timeMatch) throw new RangeError(`Fecha u hora inválida: "${date} ${time}"`);
  const [year, month, day] = [dateMatch[1], dateMatch[2], dateMatch[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = [timeMatch[1], timeMatch[2]].map(Number) as [number, number];
  if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59) {
    throw new RangeError(`Fecha u hora inválida: "${date} ${time}"`);
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Se parte de UTC-6 y se corrige con el desfase real de la zona en ese momento.
  let guess = wall + 6 * 3_600_000;
  for (let pass = 0; pass < 2; pass += 1) {
    const local = mexicoCityDateTime(new Date(guess));
    const [ly, lmo, ld] = local.date.split('-').map(Number) as [number, number, number];
    const [lh, lmi] = local.time.split(':').map(Number) as [number, number];
    guess += wall - Date.UTC(ly, lmo - 1, ld, lh, lmi);
  }
  return new Date(guess).toISOString();
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

function dateParts(date: string): { year: string; month: number; day: number } {
  const [year = '', month = '1', day = '1'] = date.split('-');
  return { year, month: Number(month), day: Number(day) };
}

/** `20 de octubre de 2026, 14:30` en hora de la Ciudad de México. */
export function formatMexicoCityDateTime(instant: Date | string): string {
  const { date, time } = mexicoCityDateTime(instant);
  const { year, month, day } = dateParts(date);
  return `${day} de ${MONTHS[month - 1]} de ${year}, ${time}`;
}

/** Forma corta: `20 oct 2026, 14:30` en hora de la Ciudad de México. */
export function formatMexicoCityDateTimeShort(instant: Date | string): string {
  const { date, time } = mexicoCityDateTime(instant);
  const { year, month, day } = dateParts(date);
  return `${day} ${MONTHS[month - 1]?.slice(0, 3)} ${year}, ${time}`;
}

/** `20 de octubre de 2026` para la fecha calendario del instante en la Ciudad de México. */
export function formatMexicoCityDate(instant: Date | string): string {
  const { year, month, day } = dateParts(mexicoCityDateTime(instant).date);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

const PERIOD = /^([0-9]{4})-(0[1-9]|1[0-2])$/;

/** Mes calendario (`YYYY-MM`) del instante en la Ciudad de México. */
export function statementPeriodOf(instant: Date | string): string {
  return mexicoCityDate(toDate(instant)).slice(0, 7);
}

/**
 * Periodos de estado de cuenta (`YYYY-MM`) que se pueden pedir: del mes de creación de la cuenta al
 * mes en curso (parcial), el más reciente primero (HIS-11). Si `createdAt` es posterior a `now`
 * (desfase de reloj), devuelve solo el mes en curso.
 */
export function listStatementPeriods(createdAt: Date | string, now: Date): string[] {
  const current = statementPeriodOf(now);
  const first = statementPeriodOf(createdAt);
  const start = first > current ? current : first;
  let [year, month] = start.split('-').map(Number) as [number, number];
  const periods: string[] = [];
  for (;;) {
    const period = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    periods.unshift(period);
    if (period >= current) return periods;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/**
 * Indica si el periodo `YYYY-MM` es anterior al mes de creación de la cuenta (HIS-11): la API
 * responde `422` con `/period` y `DATE_OUT_OF_RANGE`. Lanza `RangeError` si el periodo no tiene forma.
 */
export function isPeriodBeforeCreation(period: string, createdAt: Date | string): boolean {
  if (!PERIOD.test(period)) throw new RangeError(`Periodo inválido: "${period}"`);
  return period < statementPeriodOf(createdAt);
}

/** `septiembre de 2026` para un periodo `YYYY-MM`. */
export function statementPeriodLabel(period: string): string {
  const match = PERIOD.exec(period);
  if (!match) throw new RangeError(`Periodo inválido: "${period}"`);
  return `${MONTHS[Number(match[2]) - 1]} de ${match[1]}`;
}
