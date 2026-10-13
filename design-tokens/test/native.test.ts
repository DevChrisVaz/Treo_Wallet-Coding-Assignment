import { describe, expect, it } from 'vitest';
import { theme as nativeTheme } from '../src/native';
import { radius, spacing, theme } from '../src/index';

describe('tema de React Native', () => {
  it('DSG-08 los colores son los mismos del tema claro', () => {
    expect(nativeTheme.colors).toEqual(theme.colors);
    expect(nativeTheme.colors.action.primary).toBe('#1C4B42');
  });

  it.each([
    ['display', 'WorkSans_600SemiBold', 40, 48],
    ['h1', 'WorkSans_500Medium', 32, 40],
    ['body', 'WorkSans_400Regular', 16, 24],
    ['caption', 'WorkSans_400Regular', 12, 16],
  ] as const)('DSG-05 %s usa %s en %i/%i', (style, fontFamily, fontSize, lineHeight) => {
    expect(nativeTheme.typography[style]).toMatchObject({ fontFamily, fontSize, lineHeight });
  });

  it('DSG-05 los estilos de texto no fijan fontWeight (cada peso es su propia familia)', () => {
    for (const style of Object.values(nativeTheme.typography)) {
      expect(style).not.toHaveProperty('fontWeight');
    }
  });

  it('DSG-09 los montos usan dígitos tabulares', () => {
    expect(nativeTheme.amount.fontVariant).toEqual(['tabular-nums']);
  });

  it('DSG-06 espaciado, radios, elevación y área táctil coinciden con la fuente', () => {
    expect(nativeTheme.spacing).toEqual(spacing);
    expect(nativeTheme.radius).toEqual(radius);
    expect(nativeTheme.elevation.card.elevation).toBe(1);
    expect(nativeTheme.touchTarget).toBe(44);
  });
});
