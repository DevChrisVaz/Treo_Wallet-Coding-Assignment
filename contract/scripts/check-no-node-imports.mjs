#!/usr/bin/env node
// Falla si el build importa módulos internos de Node, con o sin el prefijo node: (CTR-15).
// El paquete debe funcionar igual en Node y en Hermes. Uso: node scripts/check-no-node-imports.mjs [directorio]
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, resolve } from 'node:path';

const dist = join(resolve(process.argv[2] ?? '.'), 'dist');
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

const violations = [];
for (const file of readdirSync(dist).filter((name) => /\.(c|m)?js$/.test(name))) {
  const source = readFileSync(join(dist, file), 'utf8');
  for (const [, specifier] of source.matchAll(SPECIFIER)) {
    if (specifier.startsWith('node:') || builtins.has(specifier)) {
      violations.push(`${file}: ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`El build importa módulos internos de Node:\n${violations.join('\n')}`);
  process.exit(1);
}

console.log('El build no importa módulos internos de Node.');
