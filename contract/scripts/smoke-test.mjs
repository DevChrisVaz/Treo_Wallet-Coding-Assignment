#!/usr/bin/env node
// Prueba de humo del paquete construido (CTR-15): se importa con import y con require, y ambas
// formas deben exponer las mismas funciones y comportarse igual. Uso: node scripts/smoke-test.mjs [directorio]
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] ?? '.');
const esm = await import(pathToFileURL(join(dir, 'dist/index.mjs')).href);
const cjs = createRequire(join(dir, 'package.json'))('./dist/index.cjs');

const failures = [];
const esmKeys = Object.keys(esm).sort().join(',');
const cjsKeys = Object.keys(cjs).sort().join(',');
if (esmKeys !== cjsKeys) failures.push(`exports distintos:\n  ESM: ${esmKeys}\n  CJS: ${cjsKeys}`);

for (const [name, module] of [
  ['ESM', esm],
  ['CJS', cjs],
]) {
  if (module.formatMXN('1250.50') !== '$1,250.50') failures.push(`${name}: formatMXN`);
  if (module.toCents('1.15') !== 115n) failures.push(`${name}: toCents`);
  if (!module.clabe.safeParse('032180000118359719').success) failures.push(`${name}: clabe`);
  if (typeof module.createApiClient !== 'function') failures.push(`${name}: createApiClient`);
}

if (failures.length > 0) {
  console.error(`La prueba de humo falló en Node ${process.version}:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(
  `Prueba de humo OK en Node ${process.version} (import y require, ${esmKeys.split(',').length} exports).`,
);
