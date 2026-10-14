#!/usr/bin/env node
// Copia el lienzo local al bundle recién construido (package-build vacía ds-bundle en cada build).
import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(here, '..', '..', 'ds-bundle');
if (!existsSync(out)) throw new Error(`No existe ${out}: corre package-build primero`);
copyFileSync(join(here, 'canvas.html'), join(out, '.canvas.html'));
console.log(`lienzo instalado en ${join(out, '.canvas.html')}`);
