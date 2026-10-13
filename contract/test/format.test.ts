import { describe, expect, it, vi } from 'vitest';
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

const ORACLE_CASES = [
  '1250.50',
  '-150.00',
  '0.01',
  '0.00',
  '999.99',
  '1000.00',
  '-1234567.89',
  '48500.00',
  '9999999999999999.99',
];

describe('formatMXN frente a Intl.NumberFormat es-MX (oráculo en Node)', () => {
  const oracle = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  it.each(ORACLE_CASES)('CTR-14 %s coincide con la convención es-MX', (amount) => {
    // Node acepta strings decimales en format() con precisión exacta.
    expect(formatMXN(amount)).toBe(oracle.format(amount as unknown as number));
  });
});

describe('formatMXN sin floats ni Intl', () => {
  it('CTR-14 es exacto por encima de 2^53 (un float convertiría ...993 en ...992)', () => {
    expect(formatMXN('9007199254740993.01')).toBe('$9,007,199,254,740,993.01');
  });

  it('CTR-14 da el mismo resultado en un entorno sin Intl (como Hermes sin soporte de strings)', () => {
    const withIntl = ORACLE_CASES.map(formatMXN);
    vi.stubGlobal('Intl', undefined);
    try {
      expect(ORACLE_CASES.map(formatMXN)).toEqual(withIntl);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
