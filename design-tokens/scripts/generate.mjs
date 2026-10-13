#!/usr/bin/env node
// Genera las hojas CSS del sistema de diseño desde el build (DSG-08). Se ejecuta con `npm run
// generate`, que construye antes. El CI regenera y falla si el resultado difiere de lo versionado.
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const { renderTailwindCss, renderTokensCss, theme } = await import(
  pathToFileURL(join(root, 'dist/index.mjs')).href
);

writeFileSync(join(root, 'generated/tokens.css'), renderTokensCss(theme));
writeFileSync(join(root, 'generated/tailwind.css'), renderTailwindCss(theme));
console.log('Hojas generadas: generated/tokens.css y generated/tailwind.css');
