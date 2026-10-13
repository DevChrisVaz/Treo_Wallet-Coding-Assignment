import { addFieldIssue, textField } from './field-errors';

/** Longitud en puntos de código, igual que `minLength`/`maxLength` de JSON Schema. */
function codePointLength(value: string): number {
  return [...value].length;
}

/** Sin espacios al inicio ni al final; `.` no incluye saltos de línea (mismo patrón del contrato). */
const NO_EDGE_SPACES = /^\S(.*\S)?$/u;

/** Teléfono nacional de 10 dígitos (`PhoneInput`). */
export const phone = textField('El teléfono es obligatorio', (value, ctx) => {
  if (!/^[0-9]{10}$/.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El teléfono debe tener 10 dígitos, sin lada ni espacios');
  }
});

/** Concepto de la transferencia (`Concept`): de 1 a 40 caracteres, sin espacios en los extremos. */
export const concept = textField('El concepto es obligatorio', (value, ctx) => {
  if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El concepto es obligatorio');
  if (codePointLength(value) > 40) {
    return addFieldIssue(ctx, 'TOO_LONG', 'El concepto admite máximo 40 caracteres');
  }
  if (!NO_EDGE_SPACES.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El concepto no puede empezar ni terminar con espacios');
  }
});

/** Referencia numérica (`Reference`): de 1 a 7 dígitos, como string. */
export const reference = textField('La referencia es obligatoria', (value, ctx) => {
  if (!/^[0-9]+$/.test(value)) {
    return addFieldIssue(ctx, 'INVALID_FORMAT', 'La referencia solo admite dígitos');
  }
  if (value.length > 7) addFieldIssue(ctx, 'TOO_LONG', 'La referencia admite máximo 7 dígitos');
});

/** Código de un solo uso de 6 dígitos (`SixDigitCode`): OTP y verificación de correo. */
export const otpCode = textField('El código es obligatorio', (value, ctx) => {
  if (!/^[0-9]{6}$/.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El código debe tener 6 dígitos');
  }
});
