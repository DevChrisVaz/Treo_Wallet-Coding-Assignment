#!/usr/bin/env node
// Verifica que cada ruta declarada en main, module, types y exports exista (DSG-01, DSG-08).
// Se ejecuta después del build. Uso: node scripts/check-exports.mjs [directorio]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

function collectPaths(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectPaths);
  return [];
}

const declared = [manifest.main, manifest.module, manifest.types, ...collectPaths(manifest.exports)]
  .filter((path) => typeof path === 'string')
  .filter((path) => !path.includes('*'));
const unique = [...new Set(declared)];
const missing = unique.filter((path) => !existsSync(join(dir, path)));

if (missing.length > 0) {
  console.error(`Rutas declaradas en package.json que no existen: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Todas las rutas del paquete existen (${unique.length}).`);
