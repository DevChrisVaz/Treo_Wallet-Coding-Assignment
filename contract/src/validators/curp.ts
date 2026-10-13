import { isValidCalendarDate } from './dates';
import { addFieldIssue, textField } from './field-errors';

/** Mismo patrón que `Curp` en el contrato. */
const CURP =
  /^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$/;
const DICTIONARY = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

/**
 * Dígito verificador de una CURP a partir de sus primeros 17 caracteres: cada carácter vale su
 * posición en el diccionario `0-9A-ZÑ` y se multiplica por su peso (de 18 a 2); el dígito es
 * (10 − suma mod 10) mod 10.
 */
export function curpCheckDigit(first17: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += DICTIONARY.indexOf(first17.charAt(i)) * (18 - i);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * CURP con estructura, fecha de nacimiento existente y dígito verificador. Solo valida el formato,
 * no consulta fuentes de identidad. El carácter 17 indica el siglo: dígito antes de 2000, letra
 * desde 2000.
 */
export const curp = textField('La CURP es obligatoria', (value, ctx) => {
  if (!CURP.test(value)) {
    return addFieldIssue(ctx, 'INVALID_FORMAT', 'La CURP no tiene un formato válido');
  }
  const century = /[0-9]/.test(value.charAt(16)) ? 1900 : 2000;
  const year = century + Number(value.slice(4, 6));
  if (!isValidCalendarDate(year, Number(value.slice(6, 8)), Number(value.slice(8, 10)))) {
    return addFieldIssue(ctx, 'INVALID_DATE', 'La fecha de nacimiento de la CURP no existe');
  }
  if (curpCheckDigit(value.slice(0, 17)) !== Number(value.charAt(17))) {
    addFieldIssue(ctx, 'INVALID_CHECK_DIGIT', 'El dígito verificador de la CURP no es válido');
  }
});
