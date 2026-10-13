import { describe, expect, it } from 'vitest';
import { palette, theme, themes } from '../src/index';

function leaves(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [];
}

describe('identidad de Treo', () => {
  it('DSG-02 la acción principal es verde profundo con texto blanco', () => {
    expect(theme.colors.action.primary).toBe('#1C4B42');
    expect(theme.colors.text.onAction).toBe('#FFFFFF');
  });

  it('DSG-02 la acción activa es lima con texto verde profundo', () => {
    expect(theme.colors.action.primaryActive).toBe('#B4E717');
    expect(theme.colors.text.onActionActive).toBe('#1C4B42');
  });

  it('DSG-02 el texto principal es la tinta de Treo', () => {
    expect(theme.colors.text.primary).toBe('#001A05');
  });
});

describe('tokens semánticos', () => {
  it('DSG-03 ningún token de texto usa el verde de marca #31C454', () => {
    const textColors = [
      ...leaves(theme.colors.text),
      ...Object.values(theme.colors.status).map((tone) => tone.fg),
      ...leaves(theme.colors.money),
    ];

    expect(textColors).not.toContain('#31C454');
  });

  it('DSG-03 el verde de marca existe solo como acento', () => {
    expect(theme.colors.accent.brand).toBe('#31C454');
  });

  it('DSG-07 cada color del tema es un color de la paleta', () => {
    const paletteValues = new Set(Object.values(palette));

    for (const color of leaves(themes.light.colors)) {
      expect(paletteValues.has(color as (typeof palette)[keyof typeof palette])).toBe(true);
    }
  });

  it('DSG-07 el tema por defecto es el claro', () => {
    expect(theme).toBe(themes.light);
  });
});
