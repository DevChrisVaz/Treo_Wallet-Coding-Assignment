import { renderTokensCss, themes } from '@devchrisvaz/wallet-design-tokens';
import { describe, expect, it } from 'vitest';

/*
 * Medición independiente del contraste WCAG 2.x (fórmula de luminancia relativa) sobre las
 * variables `--dt-*` que la web realmente recibe de los tokens, para cada tema disponible (DSG-04).
 * No usa `contrastRatio` del paquete: así el paquete y la web se verifican entre sí.
 */

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(fg: string, bg: string): number {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

function cssVariables(css: string): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/--dt-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    variables[name!] = value!;
  }
  return variables;
}

const SURFACES = ['surface', 'surface-subtle', 'surface-brand', 'surface-canvas'];
const TONES = ['success', 'warning', 'danger', 'info', 'neutral'];

/** Texto normal: 4.5:1. Los textos grandes y los componentes de interfaz: 3:1. */
const TEXT_PAIRS: [string, string][] = [
  ...SURFACES.flatMap((bg): [string, string][] => [
    ['fg', bg],
    ['fg-secondary', bg],
    ['money-in', bg],
    ['money-out', bg],
    ['action', bg],
  ]),
  ['fg-muted', 'surface'],
  ['fg-muted', 'surface-subtle'],
  ['fg-disabled', 'action-disabled'],
  ['fg-on-action', 'action'],
  ['fg-on-action-active', 'action-active'],
  ['fg-on-inverse', 'surface-inverse'],
  ['fg-on-inverse', 'surface-hero'],
  ['fg-on-hero-muted', 'surface-hero'],
  ['accent-on-dark', 'surface-hero'],
  ['fg', 'accent-on-dark'],
  ...TONES.flatMap((tone): [string, string][] => [
    [tone, `${tone}-soft`],
    [tone, 'surface'],
  ]),
];
const UI_PAIRS: [string, string][] = SURFACES.flatMap((bg): [string, string][] => [
  ['border-input', bg],
  ['focus', bg],
]);

describe.each(Object.entries(themes))('contraste del tema %s', (_name, theme) => {
  const variables = cssVariables(renderTokensCss(theme));

  function measure(fg: string, bg: string): number {
    const foreground = variables[fg];
    const background = variables[bg];
    if (!foreground || !background) throw new Error(`Variable inexistente: ${fg} / ${bg}`);
    return ratio(foreground, background);
  }

  it.each(TEXT_PAIRS)('DSG-04 WEB-23 texto --dt-%s sobre --dt-%s es al menos 4.5:1', (fg, bg) => {
    expect(measure(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)(
    'DSG-04 WEB-23 componente --dt-%s sobre --dt-%s es al menos 3:1 (bordes y foco)',
    (fg, bg) => {
      expect(measure(fg, bg)).toBeGreaterThanOrEqual(3);
    },
  );

  it('DSG-04 la fórmula da 21:1 para negro sobre blanco y 1:1 para iguales', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(ratio('#1C4B42', '#1C4B42')).toBe(1);
  });
});
