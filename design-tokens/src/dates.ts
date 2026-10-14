/** Agrupación por día de Ciudad de México, igual en web y móvil (listas de movimientos). */
const TIME_ZONE = 'America/Mexico_City';

const keyParts = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const shortDay = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });
const shortDayYear = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });

/** Día de Ciudad de México en formato `YYYY-MM-DD`. */
export function dayKey(date: Date | string): string {
  const parts = Object.fromEntries(keyParts.formatToParts(new Date(date)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function previousDay(key: string): string {
  const [year, month, day] = key.split('-').map((value) => Number.parseInt(value, 10)) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** "Hoy", "Ayer", "9 oct" o, en otro año, "28 dic 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const key = dayKey(iso);
  const today = dayKey(now);
  if (key === today) return 'Hoy';
  if (key === previousDay(today)) return 'Ayer';
  const format = key.slice(0, 4) === today.slice(0, 4) ? shortDay : shortDayYear;
  return format.format(new Date(iso)).replace(/\./g, '');
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Agrupa elementos ya ordenados en grupos de días consecutivos, sin reordenar. */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(dateOf(item));
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(dateOf(item), now), items: [item] });
  }
  return groups;
}
