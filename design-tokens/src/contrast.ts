import type { Theme } from './themes';

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new RangeError(`Color inválido: "${hex}"`);
  const [r, g, b] = match.slice(1).map((part) => channel(parseInt(part, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG 2.x entre dos colores `#RRGGBB` (de 1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Lee un token por su ruta, por ejemplo `status.danger.fg`. */
export function resolveToken(theme: Theme, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      theme.colors,
    );
  if (typeof value !== 'string') throw new RangeError(`Token inexistente: "${path}"`);
  return value;
}

export interface ContrastPair {
  fg: string;
  bg: string;
  /** 4.5 para texto (WCAG AA) y 3 para límites de componentes de interfaz. */
  min: 4.5 | 3;
}

/** Par de texto: WCAG AA para texto normal. */
function text(fg: string, bg: string): ContrastPair {
  return { fg, bg, min: 4.5 };
}

/** Par de límite de componente de interfaz (bordes, foco). */
function ui(fg: string, bg: string): ContrastPair {
  return { fg, bg, min: 3 };
}

/**
 * Combinaciones permitidas de color sobre superficie. Usar un token de texto sobre una superficie
 * que no aparece aquí no está garantizado. El acento de marca (`accent.brand`) no aparece porque es
 * decorativo: el medidor del límite diario siempre acompaña la barra con texto.
 */
export const contrastPairs: readonly ContrastPair[] = [
  ...['surface.default', 'surface.subtle', 'surface.brand'].flatMap((bg) => [
    text('text.primary', bg),
    text('text.secondary', bg),
    text('action.primary', bg),
    text('money.in', bg),
    text('money.out', bg),
    ui('border.focus', bg),
    ui('border.input', bg),
  ]),
  text('text.muted', 'surface.default'),
  text('text.muted', 'surface.subtle'),
  text('text.disabled', 'action.disabled'),
  text('text.onAction', 'action.primary'),
  text('text.onActionActive', 'action.primaryActive'),
  text('text.onInverse', 'surface.inverse'),
  ...['success', 'warning', 'danger', 'info', 'neutral'].flatMap((tone) => [
    text(`status.${tone}.fg`, `status.${tone}.bg`),
    text(`status.${tone}.fg`, 'surface.default'),
  ]),
  ui('action.primary', 'surface.default'),
];
