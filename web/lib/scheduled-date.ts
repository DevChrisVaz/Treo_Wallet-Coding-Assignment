/**
 * Fecha programada (`YYYY-MM-DD`, día de la Ciudad de México) en palabras: `20 de octubre de 2026`.
 * Es una fecha de calendario, no un instante: se interpreta a medianoche UTC y se escribe en UTC
 * para que el huso del navegador no la recorra un día (D11 de scheduled-transfers).
 */
export function formatScheduledDate(date: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

/**
 * Instante programado (RFC 3339, WEB-33) en hora de la Ciudad de México:
 * `20 de octubre de 2026, 14:30`. Una fecha sola (`YYYY-MM-DD`, formato anterior) se escribe como
 * `formatScheduledDate`.
 */
export function formatScheduledInstant(value: string): string {
  if (!value.includes('T')) return formatScheduledDate(value);
  const instant = new Date(value);
  const date = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeZone: 'America/Mexico_City',
  }).format(instant);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Mexico_City',
  }).format(instant);
  return `${date}, ${time}`;
}
