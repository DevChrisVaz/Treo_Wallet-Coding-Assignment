/** Zona horaria de negocio del sistema (límite diario, filtros y fechas). */
export const BUSINESS_TIME_ZONE = 'America/Mexico_City';

const dateTime = new Intl.DateTimeFormat('es-MX', {
  timeZone: BUSINESS_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const date = new Intl.DateTimeFormat('es-MX', {
  timeZone: BUSINESS_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const time = new Intl.DateTimeFormat('es-MX', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora en Ciudad de México: `13 oct 2026, 10:42`. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** Fecha en Ciudad de México: `13 oct 2026`. */
export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

/** Hora en Ciudad de México: `10:52`. */
export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}
