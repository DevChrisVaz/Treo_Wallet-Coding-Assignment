import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const GLOBALS = join(import.meta.dirname, 'globals.css');

let css = '';
let fixtureDir = '';

beforeAll(async () => {
  // Una "plantilla" con utilidades del sistema y otras de la paleta por defecto de Tailwind.
  fixtureDir = await mkdtemp(join(tmpdir(), 'wallet-web-css-'));
  await writeFile(
    join(fixtureDir, 'sample.html'),
    '<div class="bg-surface text-fg bg-action hover:bg-action-active rounded-pill text-h1 ' +
      'bg-red-500 text-sm text-gray-700 rounded-xl shadow-lg"></div>',
  );
  const source = await readFile(GLOBALS, 'utf8');
  const result = await postcss([tailwind({ base: fixtureDir })]).process(source, {
    from: GLOBALS,
  });
  css = result.css;
}, 30_000);

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

describe('app/globals.css', () => {
  it('DSG-01 genera las utilidades de los tokens del sistema', () => {
    expect(css).toMatch(/\.bg-surface\s*\{[^}]*var\(--dt-surface\)/);
    expect(css).toMatch(/\.bg-action\s*\{/);
    expect(css).toMatch(/\.rounded-pill\s*\{/);
    expect(css).toMatch(/\.text-h1\s*\{/);
    expect(css).toContain('--dt-action: #1C4B42');
  });

  it('DSG-01 no genera la paleta, la escala de texto ni los radios y sombras por defecto', () => {
    expect(css).not.toMatch(/\.bg-red-500\b/);
    expect(css).not.toMatch(/\.text-sm\b/);
    expect(css).not.toMatch(/\.text-gray-700\b/);
    expect(css).not.toMatch(/\.rounded-xl\b/);
    expect(css).not.toMatch(/\.shadow-lg\b/);
  });

  it('DSG-05 usa Work Sans de next/font con la pila de respaldo del sistema', () => {
    expect(css).toMatch(/--dt-font-sans:\s*var\(--font-work-sans\),\s*system-ui/);
  });

  it('DSG-06 WEB-23 muestra el anillo de foco del sistema con :focus-visible', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:[^}]*var\(--dt-focus\)/);
  });

  it('DSG-06 desactiva animaciones y transiciones con movimiento reducido', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
