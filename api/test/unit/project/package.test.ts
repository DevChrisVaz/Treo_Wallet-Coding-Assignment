import { lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  engines: { node: string };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};

describe('PLT-13 proyecto /api', () => {
  it('PLT-13 declara Node >= 20 y los scripts del flujo local', () => {
    expect(pkg.engines.node).toBe('>=20');
    for (const script of [
      'dev',
      'build',
      'start',
      'lint',
      'typecheck',
      'test',
      'test:unit',
      'test:integration',
      'db:bootstrap',
      'db:migrate',
      'db:revert',
      'db:seed',
    ]) {
      expect(pkg.scripts[script], script).toBeTruthy();
    }
  });

  it('PLT-13 instala el contrato como copia desde ../contract, no como enlace simbólico', () => {
    expect(pkg.dependencies['@devchrisvaz/wallet-contract']).toBe('file:../contract');
    expect(readFileSync(resolve(root, '.npmrc'), 'utf8')).toMatch(/^install-links=true$/m);
    const installed = resolve(root, 'node_modules/@devchrisvaz/wallet-contract');
    expect(lstatSync(installed).isSymbolicLink()).toBe(false);
  });

  it('PLT-13 expone openapi.yaml del paquete del contrato', () => {
    const require = createRequire(import.meta.url);
    const yamlPath = require.resolve('@devchrisvaz/wallet-contract/openapi.yaml');
    expect(readFileSync(yamlPath, 'utf8')).toMatch(/^openapi: 3\.1\.0/);
  });
});
