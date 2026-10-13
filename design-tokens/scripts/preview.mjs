#!/usr/bin/env node
// Escribe preview/index.html, la referencia visual local del sistema de diseño, desde el build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPreviewHtml } from './render-preview.mjs';

const root = resolve(import.meta.dirname, '..');
const tokens = await import(pathToFileURL(join(root, 'dist/index.mjs')).href);

mkdirSync(join(root, 'preview'), { recursive: true });
writeFileSync(
  join(root, 'preview/index.html'),
  renderPreviewHtml(tokens, tokens.renderTokensCss(tokens.theme)),
);
console.log('Referencia generada: preview/index.html');
