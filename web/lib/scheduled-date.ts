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
