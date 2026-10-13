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

  it('TRF-08 rechaza un monto inválido con un código de error por campo', () => {
    expect(() => Money.parse('100.005')).toThrow(MoneyParseError);
    try {
      Money.parse('100.005');
    } catch (error) {
      expect((error as MoneyParseError).code).toBe('TOO_MANY_DECIMALS');
    }
  });
});
