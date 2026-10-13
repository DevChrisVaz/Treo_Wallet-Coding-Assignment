import { addFieldIssue, textField } from './field-errors';

const CLABE = /^[0-9]{18}$/;
const WEIGHTS = [3, 7, 1] as const;

/**
 * Dígito verificador de una CLABE a partir de sus primeros 17 dígitos: cada dígito se multiplica
 * por su peso (3, 7, 1 repetidos), se suma cada producto módulo 10 y, con A = suma mod 10, el
 * dígito es (10 − A) mod 10.
 */
export function clabeCheckDigit(first17: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += (Number(first17[i]) * (WEIGHTS[i % 3] ?? 0)) % 10;
  }
  return (10 - (sum % 10)) % 10;
}

/** CLABE de 18 dígitos, como string (conserva los ceros a la izquierda), con dígito verificador. */
export const clabe = textField('La CLABE es obligatoria', (value, ctx) => {
  if (!CLABE.test(value)) {
    return addFieldIssue(ctx, 'INVALID_FORMAT', 'La CLABE debe tener exactamente 18 dígitos');
  }
  if (clabeCheckDigit(value.slice(0, 17)) !== Number(value[17])) {
    addFieldIssue(ctx, 'INVALID_CHECK_DIGIT', 'El dígito verificador de la CLABE no es válido');
  }
});
