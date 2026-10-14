import { dayLabel } from '@devchrisvaz/wallet-design-tokens';

/** Zona horaria de negocio del sistema (límite diario, filtros y fechas). */
export const BUSINESS_TIME_ZONE = 'America/Mexico_City';

const time = new Intl.DateTimeFormat('es-MX', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Más de un año: el "ahora" de referencia siempre cae en otro año que la fecha. */
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/**
 * Fecha en Ciudad de México: `13 oct 2026`. Sale de `dayLabel` de los tokens, la misma tabla fija
 * de meses que los encabezados de día (WEB-29): el `short` de Intl cambia con la versión de ICU del
 * navegador ("sep", "sept", "sept."). Con un "ahora" de otro año, `dayLabel` nunca dice "Hoy" ni
 * "Ayer" y siempre incluye el año.
 */
export function formatDate(iso: string): string {
  return dayLabel(iso, new Date(Date.parse(iso) + TWO_YEARS_MS));
}

/** Hora en Ciudad de México: `10:52`. */
export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** Fecha y hora en Ciudad de México: `13 oct 2026, 10:42`. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}
