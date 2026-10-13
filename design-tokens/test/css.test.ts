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
