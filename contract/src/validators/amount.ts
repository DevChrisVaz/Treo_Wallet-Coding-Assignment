import { addFieldIssue, textField } from './field-errors';

/** Mismo patrón que `AmountInput` en el contrato: 0 a 2 decimales, hasta 12 dígitos enteros. */
const AMOUNT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/;
const ZERO = /^0(\.0{1,2})?$/;
const TOO_MANY_DECIMALS = /^(0|[1-9][0-9]*)\.[0-9]{3,}$/;
const TOO_LARGE = /^[1-9][0-9]{12,}(\.[0-9]{1,2})?$/;

/**
 * Monto de entrada en MXN. Solo acepta strings: un número JSON ya pasó por un float y se rechaza.
 * Nunca redondea: un monto con más de 2 decimales es inválido.
 */
export const amountInput = textField('El monto es obligatorio', (value, ctx) => {
  if (TOO_MANY_DECIMALS.test(value)) {
    return addFieldIssue(ctx, 'TOO_MANY_DECIMALS', 'El monto admite máximo 2 decimales');
  }
  if (TOO_LARGE.test(value)) {
    return addFieldIssue(ctx, 'TOO_LARGE', 'El monto admite máximo 12 dígitos enteros');
  }
  if (!AMOUNT.test(value)) {
    return addFieldIssue(
      ctx,
      'INVALID_FORMAT',
      'Escribe el monto sin signos ni separadores, como 1250.50',
    );
  }
  if (ZERO.test(value)) return addFieldIssue(ctx, 'NOT_POSITIVE', 'El monto debe ser mayor que 0');
});

/** Convierte un monto válido a centavos con aritmética entera, sin pasar por floats. */
export function toCents(amount: string): bigint {
  const match = AMOUNT.exec(amount);
  if (!match) throw new RangeError(`Monto inválido: "${amount}"`);
  const [integerPart, fraction = ''] = amount.split('.') as [string, string?];
  return BigInt(integerPart) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/** Convierte centavos al string decimal del contrato, siempre con 2 decimales. */
export function centsToDecimalString(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  const integerPart = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${integerPart}.${fraction}`;
}
