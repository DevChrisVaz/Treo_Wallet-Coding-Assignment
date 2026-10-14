import { describe, expect, it } from 'vitest';
import { Money, MoneyParseError } from '../../../src/shared/money.js';

describe('TRF-08 valor Money', () => {
  it('TRF-08 convierte un string decimal a centavos sin floats y lo muestra con 2 decimales', () => {
    expect(Money.parse('1250.5').cents).toBe(125050n);
    expect(Money.parse('1250.50').toDecimalString()).toBe('1250.50');
    expect(Money.parse('1250').toDecimalString()).toBe('1250.00');
    // 1.15 * 100 con floats da 114.99999999999999.
    expect(Money.parse('1.15').cents).toBe(115n);
  });

  it('TRF-08 suma, resta y compara en centavos exactos', () => {
    const a = Money.parse('0.10');
    const b = Money.parse('0.20');
    expect(a.plus(b).cents).toBe(30n);
    expect(b.minus(a).toDecimalString()).toBe('0.10');
    expect(a.minus(b).toDecimalString()).toBe('-0.10');
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(Money.fromCents(10n))).toBe(0);
    expect(Money.fromCents(-15000n).toDecimalString()).toBe('-150.00');
  });

  it('TRF-15 se muestra como moneda es-MX con separador de miles', () => {
    expect(Money.parse('15000').toDisplayString()).toBe('$15,000.00');
    expect(Money.parse('0.5').toDisplayString()).toBe('$0.50');
    expect(Money.parse('999.99').toDisplayString()).toBe('$999.99');
    expect(Money.parse('1234567.89').toDisplayString()).toBe('$1,234,567.89');
    expect(Money.fromCents(-15000n).toDisplayString()).toBe('-$150.00');
  });

  it('TRF-08 rechaza un monto inválido con un código de error por campo', () => {
    expect(() => Money.parse('100.005')).toThrow(MoneyParseError);
    try {
      Money.parse('100.005');
    } catch (error) {
      expect((error as MoneyParseError).code).toBe('TOO_MANY_DECIMALS');
    }
  });
});

/** Vectores de la exploración: aceptados con sus centavos, o rechazados con su código. */
const vectors: [string, bigint | string][] = [
  ['1250.5', 125050n],
  ['1250.50', 125050n],
  ['0.01', 1n],
  ['999999999999.99', 99999999999999n],
  ['100.005', 'TOO_MANY_DECIMALS'],
  ['0.00', 'NOT_POSITIVE'],
  ['0', 'NOT_POSITIVE'],
  ['-5.00', 'INVALID_FORMAT'],
  ['1,250.50', 'INVALID_FORMAT'],
  ['1e3', 'INVALID_FORMAT'],
  [' 10.00', 'INVALID_FORMAT'],
  ['.50', 'INVALID_FORMAT'],
  ['007.00', 'INVALID_FORMAT'],
  ['1234567890123.00', 'TOO_LARGE'],
];

describe('TRF-08 vectores de Money.parse', () => {
  it.each(vectors)('TRF-08 "%s" → %s', (input, expected) => {
    if (typeof expected === 'bigint') {
      expect(Money.parse(input).cents).toBe(expected);
    } else {
      expect(() => Money.parse(input)).toThrow(
        expect.objectContaining({ name: 'MoneyParseError', code: expected }),
      );
    }
  });
});
