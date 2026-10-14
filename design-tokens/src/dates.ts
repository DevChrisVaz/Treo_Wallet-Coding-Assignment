/**
 * Agrupación por día de Ciudad de México, igual en web y móvil (listas de movimientos).
 *
 * Nada de Intl se crea al importar: el formateador se crea al primer uso y, si el motor no tiene
 * datos de zonas horarias (Hermes sin ICU completo, por ejemplo), se usa UTC−6 fijo, porque la
 * Ciudad de México no tiene horario de verano desde 2022. Los meses salen de una tabla fija y no de
 * ICU, que cambia de un motor a otro ("sep" o "sept", con o sin punto).
 */
const TIME_ZONE = 'America/Mexico_City';
const FIXED_OFFSET_MS = -6 * 60 * 60 * 1000;
const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** `undefined`: aún no se intenta crear; `null`: Intl no conoce la zona horaria. */
let dayParts: Intl.DateTimeFormat | null | undefined;

function dayFormatter(): Intl.DateTimeFormat | null {
  if (dayParts === undefined) {
    try {
      dayParts = new Intl.DateTimeFormat('es-MX', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    } catch {
      dayParts = null;
    }
  }
  return dayParts;
}

function calendarDay(date: Date): CalendarDay {
  const format = dayFormatter();
  if (format === null) {
    const shifted = new Date(date.getTime() + FIXED_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }
  const parts = Object.fromEntries(
    format.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number.parseInt(parts.year ?? '', 10),
    month: Number.parseInt(parts.month ?? '', 10),
    day: Number.parseInt(parts.day ?? '', 10),
  };
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

function keyOf({ year, month, day }: CalendarDay): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Día de Ciudad de México en formato `YYYY-MM-DD`. */
export function dayKey(date: Date | string): string {
  return keyOf(calendarDay(new Date(date)));
}

function previousDay(key: string): string {
  const [year, month, day] = key.split('-').map((value) => Number.parseInt(value, 10)) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** "Hoy", "Ayer", "9 oct" o, en otro año, "28 dic 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = calendarDay(new Date(iso));
  const current = calendarDay(now);
  const key = keyOf(day);
  const today = keyOf(current);
  if (key === today) return 'Hoy';
  if (key === previousDay(today)) return 'Ayer';
  const label = `${day.day} ${MONTHS[day.month - 1] ?? ''}`;
  return day.year === current.year ? label : `${label} ${day.year}`;
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Agrupa elementos ya ordenados en grupos de días consecutivos, sin reordenar. */
export function groupByDay<T>(
  items: readonly T[],
  dateOf: (item: T) => string,
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(dateOf(item));
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(dateOf(item), now), items: [item] });
  }
  return groups;
}
