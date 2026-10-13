#!/usr/bin/env node
// Verifica que la versión del paquete coincida con info.version del contrato (CTR-02).
// Uso: node scripts/check-version.mjs [directorio]   (por defecto, el directorio actual)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const dir = resolve(process.argv[2] ?? '.');
const packageVersion = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
const contractVersion = parse(readFileSync(join(dir, 'openapi.yaml'), 'utf8'))?.info?.version;

if (packageVersion !== contractVersion) {
  console.error(
    `La versión del paquete (${packageVersion}) no coincide con info.version del contrato (${contractVersion}).`,
  );
  process.exit(1);
}

console.log(`Versión alineada: ${packageVersion}`);
