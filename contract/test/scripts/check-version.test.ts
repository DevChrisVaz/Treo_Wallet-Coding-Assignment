import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/check-version.mjs');

function fixture(packageVersion: string, contractVersion: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-version-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: packageVersion }));
  writeFileSync(
    join(dir, 'openapi.yaml'),
    `openapi: 3.1.0\ninfo:\n  title: Test\n  version: ${contractVersion}\npaths: {}\n`,
  );
  return dir;
}

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
}

describe('check:version', () => {
  it('CTR-02 pasa cuando la versión del paquete es igual a info.version', () => {
    const result = run(fixture('1.4.0', '1.4.0'));

    expect(result.status).toBe(0);
  });

  it('CTR-02 falla y muestra ambas versiones cuando difieren', () => {
    const result = run(fixture('1.4.0', '2.0.0'));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('1.4.0');
    expect(result.stderr).toContain('2.0.0');
  });

  it('CTR-02 el paquete real está alineado con su contrato', () => {
    const result = run(resolve(__dirname, '../..'));

    expect(result.status).toBe(0);
  });
});
