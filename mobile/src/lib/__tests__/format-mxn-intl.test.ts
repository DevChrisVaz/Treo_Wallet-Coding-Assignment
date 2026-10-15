/**
 * @jest-environment node
 */
import { formatMXN } from '@devchrisvaz/wallet-contract';

// `formatMXN` usa Intl.NumberFormat es-MX (con BigInt) y, si Intl no existe, un formateo manual.
// Hermes puede no traer Intl en todas las plataformas: ambos caminos deben dar el mismo texto.
const CASES: [string, string][] = [
  ['0', '$0.00'],
  ['0.10', '$0.10'],
  ['5', '$5.00'],
  ['999.99', '$999.99'],
  ['1000', '$1,000.00'],
  ['10000.00', '$10,000.00'],
  ['1234567.89', '$1,234,567.89'],
  ['-150.00', '-$150.00'],
  ['-0.05', '-$0.05'],
  ['999999999999.99', '$999,999,999,999.99'],
  ['90071992547409.93', '$90,071,992,547,409.93'],
];

describe('formatMXN con y sin Intl', () => {
  const realIntl = globalThis.Intl;
  afterEach(() => {
    globalThis.Intl = realIntl;
  });

  function withoutIntl<T>(run: () => T): T {
    // @ts-expect-error simula un motor sin Intl
    delete globalThis.Intl;
    try {
      return run();
    } finally {
      globalThis.Intl = realIntl;
    }
  }

  test.each(CASES)('CTR-14 con Intl formatea %s como %s', (input, expected) => {
    expect(typeof Intl).toBe('object');
    expect(formatMXN(input)).toBe(expected);
  });

  test.each(CASES)('CTR-14 sin Intl formatea %s como %s', (input, expected) => {
    withoutIntl(() => {
      expect(typeof Intl).toBe('undefined');
      expect(formatMXN(input)).toBe(expected);
    });
  });

  test('CTR-14 con y sin Intl devuelve exactamente las mismas cadenas', () => {
    const conIntl = CASES.map(([input]) => formatMXN(input));
    const sinIntl = withoutIntl(() => CASES.map(([input]) => formatMXN(input)));
    expect(sinIntl).toEqual(conIntl);
  });
});
