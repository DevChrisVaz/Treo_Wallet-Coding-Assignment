import { resolveToken } from './contrast';
import { elevation, focusRing, fontFamily, motion, radius, typography } from './scale';
import type { Theme } from './themes';

/**
 * Nombre de cada color semántico en CSS (`--dt-<name>`) y en Tailwind (`--color-<name>`, de donde
 * salen utilidades como `bg-surface`, `text-fg` o `border-input`).
 */
export const cssColorTokens = [
  { path: 'surface.default', name: 'surface' },
  { path: 'surface.subtle', name: 'surface-subtle' },
  { path: 'surface.brand', name: 'surface-brand' },
  { path: 'surface.inverse', name: 'surface-inverse' },
  { path: 'text.primary', name: 'fg' },
  { path: 'text.secondary', name: 'fg-secondary' },
  { path: 'text.muted', name: 'fg-muted' },
  { path: 'text.disabled', name: 'fg-disabled' },
  { path: 'text.onAction', name: 'fg-on-action' },
  { path: 'text.onActionActive', name: 'fg-on-action-active' },
  { path: 'text.onInverse', name: 'fg-on-inverse' },
  { path: 'action.primary', name: 'action' },
  { path: 'action.primaryActive', name: 'action-active' },
  { path: 'action.disabled', name: 'action-disabled' },
  { path: 'border.default', name: 'border' },
  { path: 'border.input', name: 'border-input' },
  { path: 'border.focus', name: 'focus' },
  { path: 'accent.brand', name: 'accent' },
  ...(['success', 'warning', 'danger', 'info', 'neutral'] as const).flatMap((tone) => [
    { path: `status.${tone}.fg`, name: tone },
    { path: `status.${tone}.bg`, name: `${tone}-soft` },
  ]),
  { path: 'money.in', name: 'money-in' },
  { path: 'money.out', name: 'money-out' },
] as const;

const HEADER = '/* Generado por scripts/generate.mjs desde src/: no editar a mano. */';

function rem(px: number): string {
  return `${px / 16}rem`;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function rootDeclarations(theme: Theme): string[] {
  return [
    ...cssColorTokens.map(({ path, name }) => `--dt-${name}: ${resolveToken(theme, path)};`),
    `--dt-font-sans: ${fontFamily.sans};`,
    ...Object.entries(typography).flatMap(([style, value]) => [
      `--dt-text-${kebab(style)}: ${rem(value.fontSize)};`,
      `--dt-text-${kebab(style)}-line-height: ${rem(value.lineHeight)};`,
      `--dt-text-${kebab(style)}-letter-spacing: ${value.letterSpacing}px;`,
      `--dt-text-${kebab(style)}-font-weight: ${value.fontWeight};`,
    ]),
    ...Object.entries(radius).map(([size, value]) => `--dt-radius-${size}: ${value}px;`),
    `--dt-shadow-card: ${elevation.card.css};`,
    `--dt-focus-width: ${focusRing.width}px;`,
    `--dt-focus-offset: ${focusRing.offset}px;`,
    `--dt-motion-fast: ${motion.fast}ms;`,
    `--dt-motion-base: ${motion.base}ms;`,
    `--dt-ease-standard: ${motion.easing};`,
  ];
}

function block(selector: string, declarations: string[]): string {
  return `${selector} {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}\n`;
}

/** Variables `--dt-*` del tema en `:root`, sin depender de ningún framework. */
export function renderTokensCss(theme: Theme): string {
  return `${HEADER}\n${block(':root', rootDeclarations(theme))}`;
}

/**
 * Hoja para Tailwind v4: las variables `--dt-*` en `:root`, la paleta por defecto eliminada y un
 * bloque `@theme inline` que conecta las utilidades con las variables. Un tema futuro solo
 * redefine `--dt-*` (por ejemplo bajo `[data-theme="dark"]`).
 */
export function renderTailwindCss(theme: Theme): string {
  const reset = [
    '--color-*: initial;',
    '--text-*: initial;',
    '--radius-*: initial;',
    '--shadow-*: initial;',
  ];
  const inline = [
    ...cssColorTokens.map(({ name }) => `--color-${name}: var(--dt-${name});`),
    '--font-sans: var(--dt-font-sans);',
    ...Object.keys(typography).flatMap((style) => {
      const name = kebab(style);
      return [
        `--text-${name}: var(--dt-text-${name});`,
        `--text-${name}--line-height: var(--dt-text-${name}-line-height);`,
        `--text-${name}--letter-spacing: var(--dt-text-${name}-letter-spacing);`,
        `--text-${name}--font-weight: var(--dt-text-${name}-font-weight);`,
      ];
    }),
    ...Object.keys(radius).map((size) => `--radius-${size}: var(--dt-radius-${size});`),
    '--shadow-card: var(--dt-shadow-card);',
    '--ease-standard: var(--dt-ease-standard);',
  ];
  return [
    HEADER,
    block(':root', rootDeclarations(theme)),
    block('@theme', reset),
    block('@theme inline', inline),
  ].join('\n');
}
