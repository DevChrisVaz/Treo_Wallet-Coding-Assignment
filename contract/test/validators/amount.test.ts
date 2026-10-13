import { describe, expect, it } from 'vitest';
import { amountInput, centsToDecimalString, toCents, toFieldErrors } from '../../src/index';
import { amountVectors } from '../vectors/amount';

describe('amountInput', () => {
  it.each(amountVectors)('CTR-08 $input → válido: $valid ($code)', (vector) => {
    const result = amountInput.safeParse(vector.input);

    expect(result.success).toBe(vector.valid);
    if (!result.success) expect(toFieldErrors(result.error)[0]?.code).toBe(vector.code);
  });

  it('CTR-08 redondeo: "100.005" se rechaza sin producir un valor redondeado', () => {
    const result = amountInput.safeParse('100.005');

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(() => toCents('100.005')).toThrow(RangeError);
  });
});

describe('toCents', () => {
  it.each(amountVectors.filter((v) => v.valid))('CTR-08 $input → $cents centavos', (vector) => {
    expect(toCents(vector.input as string)).toBe(vector.cents);
  });

  it('CTR-08 la suma de "0.10" y "0.20" es exactamente 30 centavos', () => {
    expect(toCents('0.10') + toCents('0.20')).toBe(30n);
  });
});

describe('centsToDecimalString', () => {
  it.each([
    [125050n, '1250.50'],
    [1n, '0.01'],
    [10n, '0.10'],
    [0n, '0.00'],
    [-15000n, '-150.00'],
    [-5n, '-0.05'],
    [99999999999999n, '999999999999.99'],
    [999999999999999999n, '9999999999999999.99'],
  ])('CTR-08 %s centavos → "%s"', (cents, expected) => {
    expect(centsToDecimalString(cents)).toBe(expected);
  });
});
