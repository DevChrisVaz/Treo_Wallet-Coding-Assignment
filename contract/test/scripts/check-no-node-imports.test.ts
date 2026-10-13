import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-no-node-imports.mjs');

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'no-node-imports-'));
  mkdirSync(join(dir, 'dist'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, 'dist', name), content);
  }
  return dir;
}

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
}

describe('check:no-node-imports', () => {
  it('CTR-15 pasa cuando el build solo importa sus dependencias declaradas', () => {
    const dir = fixture({
      'index.mjs': 'import createClient from "openapi-fetch";\nimport * as z from "zod";\n',
      'index.cjs': 'const z = require("zod");\n',
    });

    expect(run(dir).status).toBe(0);
  });

  it('CTR-15 falla con un require("node:crypto") y nombra el archivo', () => {
    const dir = fixture({ 'index.cjs': 'const { randomUUID } = require("node:crypto");\n' });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index.cjs');
    expect(result.stderr).toContain('node:crypto');
  });

  it('CTR-15 falla con un módulo interno importado sin el prefijo node:', () => {
    const dir = fixture({ 'index.mjs': 'import { readFileSync } from "fs";\n' });
    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fs');
  });

  it('CTR-15 detecta también los import() dinámicos', () => {
    const dir = fixture({ 'index.mjs': 'const os = await import("node:os");\n' });

    expect(run(dir).status).toBe(1);
  });
});
