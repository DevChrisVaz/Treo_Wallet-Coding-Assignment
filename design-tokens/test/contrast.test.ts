import { describe, expect, it } from 'vitest';
import { contrastPairs, contrastRatio, resolveToken, theme } from '../src/index';

describe('contrastRatio (WCAG 2.x)', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#767676', '#FFFFFF', 4.54],
    ['#777777', '#FFFFFF', 4.48],
  ])('DSG-04 %s sobre %s → %s:1', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it('DSG-04 el gris #7E7E7E de Treo no cumple AA como texto sobre blanco', () => {
    expect(contrastRatio('#7E7E7E', '#FFFFFF')).toBeLessThan(4.5);
  });
});

describe('pares declarados del tema claro', () => {
  it.each(contrastPairs.map((pair) => [pair.fg, pair.bg, pair.min] as const))(
    'DSG-04 %s sobre %s cumple al menos %s:1',
    (fg, bg, min) => {
      const ratio = contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg));
      expect(ratio).toBeGreaterThanOrEqual(min);
    },
  );

  it('DSG-04 cubre todos los textos, estados y montos del tema', () => {
    const declaredForeground = new Set(contrastPairs.map((pair) => pair.fg));
    const required = [
      ...Object.keys(theme.colors.text).map((key) => `text.${key}`),
      ...Object.keys(theme.colors.status).map((tone) => `status.${tone}.fg`),
      'money.in',
      'money.out',
      'border.input',
      'border.focus',
    ];

    for (const token of required) expect(declaredForeground.has(token)).toBe(true);
  });
});

describe('pares del hero (DSG-14)', () => {
  it.each([
    ['text.onInverse', 'surface.hero'],
    ['text.onHeroMuted', 'surface.hero'],
    ['accent.onDark', 'surface.hero'],
    ['text.primary', 'accent.onDark'],
  ])('DSG-14 %s sobre %s está declarado y cumple 4.5:1', (fg, bg) => {
    expect(contrastPairs.some((pair) => pair.fg === fg && pair.bg === bg)).toBe(true);
    expect(contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('DSG-14 el lima como texto sobre blanco no llega a 4.5:1', () => {
    expect(contrastRatio(theme.colors.accent.onDark, theme.colors.surface.default)).toBeLessThan(4.5);
  });
});
