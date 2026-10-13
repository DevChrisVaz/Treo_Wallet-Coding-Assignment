import { describe, expect, it } from 'vitest';
import { formatMXN } from '../src/index';

describe('formatMXN', () => {
  it.each([
    ['1250.50', '$1,250.50'],
    ['-150.00', '-$150.00'],
    ['0.01', '$0.01'],
    ['0.00', '$0.00'],
    ['100.00', '$100.00'],
    ['1000.00', '$1,000.00'],
    ['1000000.00', '$1,000,000.00'],
    ['1250.5', '$1,250.50'],
    ['1250', '$1,250.00'],
    ['9999999999999999.99', '$9,999,999,999,999,999.99'],
  ])('CTR-14 %s → %s', (amount, expected) => {
    expect(formatMXN(amount)).toBe(expected);
  });

  it.each(['abc', '1,250.50', '1e3', '', '1.005', '-'])(
    'CTR-14 rechaza el monto inválido "%s" en lugar de inventar un valor',
    (amount) => {
      expect(() => formatMXN(amount)).toThrow(RangeError);
    },
  );
});
