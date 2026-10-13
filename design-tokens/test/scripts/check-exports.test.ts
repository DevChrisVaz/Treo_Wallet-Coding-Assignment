import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-exports.mjs');

const manifest = {
  main: './dist/index.cjs',
  module: './dist/index.mjs',
  types: './dist/index.d.cts',
  exports: {
    '.': {
      import: { types: './dist/index.d.ts', default: './dist/index.mjs' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    },
    './openapi.yaml': './openapi.yaml',
  },
};

function fixture(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-exports-'));
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  for (const file of files) writeFileSync(join(dir, file), '');
  return dir;
}

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
}

const allFiles = [
  'dist/index.cjs',
  'dist/index.mjs',
  'dist/index.d.ts',
  'dist/index.d.cts',
  'openapi.yaml',
];

describe('check:exports', () => {
  it('DSG-01 pasa cuando existen todos los archivos de main, module, types y exports', () => {
    expect(run(fixture(allFiles)).status).toBe(0);
  });

  it('DSG-01 falla y nombra el archivo cuando una ruta de exports no existe', () => {
    const result = run(fixture(allFiles.filter((f) => f !== 'dist/index.d.ts')));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('./dist/index.d.ts');
  });

  it('DSG-08 falla cuando falta openapi.yaml, que la API lee por el subpath', () => {
    const result = run(fixture(allFiles.filter((f) => f !== 'openapi.yaml')));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('./openapi.yaml');
  });
});
