import { describe, expect, it } from 'vitest';
import { maskClabe, normalizeAmountInput, percentUsed, signedAmount, sumAmounts } from './money';

describe('signedAmount', () => {
  it('DSG-09 una entrada se muestra con + y formatMXN', () => {
    expect(signedAmount('in', '150.00')).toBe('+$150.00');
    expect(signedAmount('in', '1250.50')).toBe('+$1,250.50');
  });

  it('DSG-09 una salida se muestra con el signo menos U+2212, sin duplicar el signo de la API', () => {
    expect(signedAmount('out', '-150.00')).toBe('−$150.00');
    expect(signedAmount('out', '850.50')).toBe('−$850.50');
  });

  it('WEB-21 no pasa por floats: conserva montos que un float redondearía', () => {
    expect(signedAmount('in', '9007199254740993.01')).toBe('+$9,007,199,254,740,993.01');
  });
});

describe('maskClabe', () => {
  it('DSG-11 enmascara la CLABE salvo los últimos 4 dígitos', () => {
    expect(maskClabe('032180000118359719')).toBe('•••• 9719');
  });
});

describe('normalizeAmountInput', () => {
  it('WEB-21 quita los separadores de miles y los espacios, sin redondear', () => {
    expect(normalizeAmountInput('1,250.50')).toBe('1250.50');
    expect(normalizeAmountInput(' 25,000 ')).toBe('25000');
    expect(normalizeAmountInput('100.005')).toBe('100.005');
  });
});

describe('percentUsed', () => {
  it('WEB-13 calcula con enteros el porcentaje usado del límite diario', () => {
    expect(percentUsed('12000.00', '50000.00')).toBe(24);
    expect(percentUsed('18500.00', '50000.00')).toBe(37);
    expect(percentUsed('0.00', '50000.00')).toBe(0);
  });

  it('WEB-13 se queda entre 0 y 100 aunque lo usado supere el límite o el límite sea 0', () => {
    expect(percentUsed('60000.00', '50000.00')).toBe(100);
    expect(percentUsed('0.00', '0.00')).toBe(100);
  });
});

describe('sumAmounts', () => {
  it('WEB-28 suma los saldos en centavos sin punto flotante', () => {
    expect(sumAmounts(['25000.00', '10000.00'])).toBe('35000.00');
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
  });
});
