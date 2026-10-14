/**
 * @jest-environment node
 */
import { formatMXN } from '@devchrisvaz/wallet-contract';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { movementPresentation, sumAmounts } from '../display';

const SRC = join(__dirname, '..', '..');

function appFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'test-utils' ? [] : appFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('formato de montos en es-MX', () => {
  test('MOB-15 formatea a partir de los strings que devuelve la API', () => {
    expect(formatMXN('1234567.89')).toBe('$1,234,567.89');
    expect(formatMXN('0.10')).toBe('$0.10');
    expect(formatMXN('-150.00')).toBe('-$150.00');
  });

  test('MOB-15 conserva todos los dígitos de montos que un float no representa', () => {
    expect(formatMXN('999999999999.99')).toBe('$999,999,999,999.99');
    expect(formatMXN('90071992547409.93')).toBe('$90,071,992,547,409.93');
  });

  test('MOB-15 una salida se muestra con el signo menos tipográfico del sistema de diseño', () => {
    expect(movementPresentation('TRANSFER_OUT', '-150.00').amountText).toBe('−$150.00');
  });

  test('MOB-15 ningún archivo de la app convierte montos a punto flotante', () => {
    const offenders = appFiles(SRC)
      .filter((file) =>
        /\bparseFloat\(|\.toFixed\(|Number\(\s*\w*(amount|balance|remaining)/i.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

describe('sumAmounts', () => {
  test('MOB-19 suma los saldos en centavos sin punto flotante', () => {
    expect(sumAmounts(['25000.00', '10000.00'])).toBe('35000.00');
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
  });
});
