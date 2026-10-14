import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cssColorTokens,
  renderTailwindCss,
  renderTokensCss,
  resolveToken,
  theme,
} from '../src/index';

function colorLeafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      colorLeafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

const tokensCss = renderTokensCss(theme);
const tailwindCss = renderTailwindCss(theme);

describe('tabla de variables CSS', () => {
  it('DSG-08 incluye cada color del tema exactamente una vez', () => {
    const mapped = cssColorTokens.map((token) => token.path).sort();
    expect(mapped).toEqual(colorLeafPaths(theme.colors).sort());
  });
});

describe('tokens.css', () => {
  it.each(cssColorTokens.map((token) => [token.name, token.path] as const))(
    'DSG-08 --dt-%s tiene el mismo valor que %s',
    (name, path) => {
      expect(tokensCss).toContain(`--dt-${name}: ${resolveToken(theme, path)};`);
    },
  );

  it('DSG-07 define los tokens en :root para que un tema futuro los redefina', () => {
    expect(tokensCss).toMatch(/^:root \{$/m);
  });

  it('DSG-05 expone la pila tipográfica y la escala en rem', () => {
    expect(tokensCss).toContain('--dt-font-sans: "Work Sans", system-ui');
    expect(tokensCss).toContain('--dt-text-display: 2.5rem;');
    expect(tokensCss).toContain('--dt-text-caption: 0.75rem;');
  });
});

describe('tailwind.css', () => {
  it('DSG-01 quita la paleta por defecto de Tailwind', () => {
    expect(tailwindCss).toContain('--color-*: initial;');
  });

  it.each(cssColorTokens.map((token) => token.name))(
    'DSG-08 el color %s de Tailwind apunta a su variable --dt-*',
    (name) => {
      expect(tailwindCss).toContain(`--color-${name}: var(--dt-${name});`);
    },
  );

  it('DSG-06 expone los radios y el de píldora', () => {
    expect(tailwindCss).toContain('--radius-md: var(--dt-radius-md);');
    expect(tailwindCss).toContain('--radius-pill: var(--dt-radius-pill);');
  });

  it('DSG-08 es autocontenido: incluye las variables --dt-* sin importar otro archivo', () => {
    expect(tailwindCss).not.toContain('@import');
    expect(tailwindCss).toContain(`--dt-action: ${theme.colors.action.primary};`);
  });
});

describe('archivos generados', () => {
  it.each([
    ['generated/tokens.css', tokensCss],
    ['generated/tailwind.css', tailwindCss],
  ])('DSG-08 %s está al día con la fuente', (file, expected) => {
    expect(readFileSync(resolve(__dirname, '..', file), 'utf8')).toBe(expected);
  });
});

describe('tokens v2 en CSS', () => {
  it.each([
    ['--dt-surface-canvas: #F6F5F2;'],
    ['--dt-surface-hero: #1C4B42;'],
    ['--dt-fg-on-hero-muted: #BFCDCA;'],
    ['--dt-accent-on-dark: #B4E717;'],
    ['--dt-text-display-xl: 3rem;'],
    ['--dt-text-display-xl-line-height: 3.5rem;'],
    ['--dt-layout-tab-bar-height: 64px;'],
    ['--dt-layout-app-column-max: 480px;'],
    ['--dt-layout-sidebar-width: 248px;'],
    ['--dt-layout-content-max: 1200px;'],
    ['--dt-icon-md: 20px;'],
    ['--dt-avatar-md: 40px;'],
  ])('DSG-16 tokens.css define %s', (declaration) => {
    expect(tokensCss).toContain(declaration);
  });

  it('DSG-16 Tailwind expone los puntos de cambio de la app y del dashboard', () => {
    expect(tailwindCss).toContain('--breakpoint-app: 30rem;');
    expect(tailwindCss).toContain('--breakpoint-dashboard: 64rem;');
  });

  it('DSG-16 Tailwind expone anchos, sombras y el display mayor', () => {
    expect(tailwindCss).toContain('--container-app: var(--dt-layout-app-column-max);');
    expect(tailwindCss).toContain('--container-content: var(--dt-layout-content-max);');
    expect(tailwindCss).toContain('--container-sidebar: var(--dt-layout-sidebar-width);');
    expect(tailwindCss).toContain('--shadow-raised: var(--dt-shadow-raised);');
    expect(tailwindCss).toContain('--shadow-sheet: var(--dt-shadow-sheet);');
    expect(tailwindCss).toContain('--text-display-xl: var(--dt-text-display-xl);');
  });
});
