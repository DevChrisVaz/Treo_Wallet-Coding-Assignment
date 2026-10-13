#!/usr/bin/env node
// Prueba de humo del paquete construido (DSG-01, DSG-08): "." y "./native" con import y require,
// el respaldo native/ para resolvedores sin exports, y las hojas CSS por sus subpaths.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] ?? '.');
const requireFromPackage = createRequire(join(dir, 'package.json'));
const failures = [];

const esm = await import(pathToFileURL(join(dir, 'dist/index.mjs')).href);
const cjs = requireFromPackage('./dist/index.cjs');
const nativeEsm = await import(pathToFileURL(join(dir, 'dist/native.mjs')).href);
const nativeCjs = requireFromPackage('./dist/native.cjs');
const nativeFallback = requireFromPackage('./native');

const keys = (module) => Object.keys(module).sort().join(',');
if (keys(esm) !== keys(cjs)) failures.push('"." expone exports distintos en ESM y CJS');
if (keys(nativeEsm) !== keys(nativeCjs)) failures.push('"./native" expone exports distintos');

for (const [name, module] of [
  ['ESM', esm],
  ['CJS', cjs],
]) {
  if (module.theme.colors.action.primary !== '#1C4B42') failures.push(`${name}: theme`);
  if (module.problemMessage('NO_EXISTE') !== module.problemMessages.INTERNAL_ERROR) {
    failures.push(`${name}: problemMessage`);
  }
}
for (const [name, module] of [
  ['ESM', nativeEsm],
  ['CJS', nativeCjs],
  ['respaldo', nativeFallback],
]) {
  if (module.theme.typography.h1.fontFamily !== 'WorkSans_500Medium') {
    failures.push(`native ${name}: tipografía`);
  }
}

for (const sheet of ['tokens.css', 'tailwind.css']) {
  const css = readFileSync(join(dir, 'generated', sheet), 'utf8');
  if (!css.includes('--dt-action: #1C4B42;')) failures.push(`${sheet}: falta --dt-action`);
}

if (failures.length > 0) {
  console.error(`La prueba de humo falló en Node ${process.version}:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log(
  `Prueba de humo OK en Node ${process.version} (".", "./native", respaldo y hojas CSS).`,
);
