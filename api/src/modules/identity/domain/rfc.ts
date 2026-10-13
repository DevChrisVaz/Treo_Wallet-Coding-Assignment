import { isValidCalendarDate } from './calendar.js';

/** Mismo patrón que `Rfc` en el contrato: persona física, 13 caracteres. */
const RFC = /^[A-ZÑ&]{4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/u;

export type RfcValidation = 'VALID' | 'INVALID_FORMAT' | 'INVALID_DATE';

/**
 * RFC de persona física con fecha real (IDN-02). El RFC no indica el siglo, así que la fecha es
 * válida si existe en 19AA o en 20AA. No se exige que coincida con la CURP.
 */
export function validateRfc(value: string): RfcValidation {
  if (!RFC.test(value)) return 'INVALID_FORMAT';
  const characters = [...value];
  const yy = Number(characters.slice(4, 6).join(''));
  const month = Number(characters.slice(6, 8).join(''));
  const day = Number(characters.slice(8, 10).join(''));
  return isValidCalendarDate(1900 + yy, month, day) || isValidCalendarDate(2000 + yy, month, day)
    ? 'VALID'
    : 'INVALID_DATE';
}
