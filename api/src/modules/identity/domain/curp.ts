import { isValidCalendarDate } from './calendar.js';

/** Mismo patrón que `Curp` en el contrato. */
const CURP =
  /^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$/;
const DICTIONARY = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

export type CurpValidation = 'VALID' | 'INVALID_FORMAT' | 'INVALID_DATE' | 'INVALID_CHECK_DIGIT';

/**
 * Dígito verificador a partir de los primeros 17 caracteres: cada carácter vale su posición en el
 * diccionario `0-9A-ZÑ` y se multiplica por su peso (18 a 2); el dígito es (10 − suma mod 10) mod 10.
 */
export function curpCheckDigit(first17: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += DICTIONARY.indexOf(first17.charAt(i)) * (18 - i);
  return (10 - (sum % 10)) % 10;
}

/**
 * Estructura, fecha de nacimiento existente y dígito verificador (IDN-02). Solo valida el formato;
 * no consulta fuentes de identidad. El carácter 17 indica el siglo: dígito antes de 2000, letra desde.
 */
export function validateCurp(value: string): CurpValidation {
  if (!CURP.test(value)) return 'INVALID_FORMAT';
  const century = /[0-9]/.test(value.charAt(16)) ? 1900 : 2000;
  const year = century + Number(value.slice(4, 6));
  if (!isValidCalendarDate(year, Number(value.slice(6, 8)), Number(value.slice(8, 10)))) {
    return 'INVALID_DATE';
  }
  return curpCheckDigit(value.slice(0, 17)) === Number(value.charAt(17))
    ? 'VALID'
    : 'INVALID_CHECK_DIGIT';
}
