import { isValidCalendarDate } from './dates';
import { addFieldIssue, textField } from './field-errors';

/** Mismo patrón que `Rfc` en el contrato: persona física, 13 caracteres. */
const RFC = /^[A-ZÑ&]{4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/u;

/**
 * RFC de persona física con fecha existente. El RFC no indica el siglo, así que la fecha es válida
 * si existe en 19AA o en 20AA. No se exige que coincida con la CURP.
 */
export const rfc = textField('El RFC es obligatorio', (value, ctx) => {
  if (!RFC.test(value)) {
    return addFieldIssue(ctx, 'INVALID_FORMAT', 'El RFC no tiene un formato válido');
  }
  const characters = [...value];
  const yy = Number(characters.slice(4, 6).join(''));
  const month = Number(characters.slice(6, 8).join(''));
  const day = Number(characters.slice(8, 10).join(''));
  if (!isValidCalendarDate(1900 + yy, month, day) && !isValidCalendarDate(2000 + yy, month, day)) {
    addFieldIssue(ctx, 'INVALID_DATE', 'La fecha del RFC no existe');
  }
});
