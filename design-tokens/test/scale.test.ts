import { describe, expect, it } from 'vitest';
import {
  focusRing,
  fontFamily,
  motion,
  nativeFontFamily,
  radius,
  spacing,
  touchTarget,
  typography,
} from '../src/index';

describe('tipografía', () => {
  it('DSG-05 ningún estilo es menor a 12 px', () => {
    for (const style of Object.values(typography))
      expect(style.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('DSG-05 cada peso usado tiene su familia de Work Sans para React Native', () => {
    for (const style of Object.values(typography)) {
      expect(nativeFontFamily[style.fontWeight]).toMatch(/^WorkSans_\d00/);
    }
    expect(nativeFontFamily[600]).toBe('WorkSans_600SemiBold');
  });

  it('DSG-05 la pila web empieza con Work Sans y termina en una genérica', () => {
    expect(fontFamily.sans.startsWith('"Work Sans"')).toBe(true);
    expect(fontFamily.sans.trim().endsWith('sans-serif')).toBe(true);
  });

  it('DSG-05 el interlineado nunca es menor que el tamaño', () => {
    for (const style of Object.values(typography)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });
});

describe('espaciado, forma y movimiento', () => {
  it('DSG-06 el espaciado es múltiplo de 4', () => {
    for (const value of Object.values(spacing)) expect(value % 4).toBe(0);
  });

  it('DSG-06 las tarjetas usan el radio de 9 px de Treo y los botones son píldora', () => {
    expect(radius.md).toBe(9);
    expect(radius.pill).toBeGreaterThanOrEqual(9999);
  });

  it('DSG-06 el área táctil mínima es de 44 px', () => {
    expect(touchTarget).toBeGreaterThanOrEqual(44);
  });

  it('DSG-06 el anillo de foco tiene 2 px con 2 px de separación', () => {
    expect(focusRing).toEqual({ width: 2, offset: 2 });
  });

  it('DSG-06 las animaciones duran 250 ms o menos', () => {
    expect(motion.fast).toBeLessThanOrEqual(motion.base);
    expect(motion.base).toBeLessThanOrEqual(250);
  });
});
