import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

/*
 * Requisitos de infraestructura que el CI hace cumplir (CTR-01, CTR-03, CTR-17, PLT-17): estas
 * pruebas fallan si el contrato, los tipos generados o los workflows se salen de lo prometido.
 */

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

interface OpenApi {
  openapi: string;
  paths: Record<string, Record<string, { operationId?: string }>>;
}
const openapi = parse(read('contract/openapi.yaml')) as OpenApi;
const pkg = JSON.parse(read('contract/package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('CTR-01 el contrato OpenAPI es la fuente de verdad', () => {
  it('CTR-01 es OpenAPI 3.1 y el paquete publica el archivo', () => {
    expect(openapi.openapi).toMatch(/^3\.1\./);
    expect(pkg.exports['./openapi.yaml']).toBe('./openapi.yaml');
  });

  it('CTR-01 cada operación tiene un operationId único', () => {
    const ids = Object.values(openapi.paths).flatMap((item) =>
      Object.values(item)
        .map((operation) => operation.operationId)
        .filter((id): id is string => id !== undefined),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('CTR-03 los tipos se generan desde el contrato', () => {
  it('CTR-03 el script generate lee el contrato y escribe src/generated/api.d.ts', () => {
    expect(pkg.scripts.generate).toBe('openapi-typescript openapi.yaml -o src/generated/api.d.ts');
  });

  it('CTR-03 todas las rutas del contrato aparecen en los tipos generados', () => {
    const generated = read('contract/src/generated/api.d.ts');
    for (const path of Object.keys(openapi.paths)) {
      expect(generated, path).toContain(`"${path}": {`);
    }
  });
});

describe('CTR-17 y PLT-17 la verificación continua cubre los proyectos', () => {
  it('CTR-17 el workflow del contrato corre lint del contrato, tipos, lint, formato, pruebas y build', () => {
    const workflow = read('.github/workflows/contract.yml');
    for (const step of [
      'npm run lint:contract',
      'npm run typecheck',
      'npm run lint',
      'npm run format:check',
      'npm test',
      'npm run build',
    ]) {
      expect(workflow, step).toContain(`run: ${step}`);
    }
  });

  for (const name of ['api', 'web', 'mobile', 'contract']) {
    it(`PLT-17 el workflow de ${name} corre lint y pruebas al integrar en release`, () => {
      const workflow = read(`.github/workflows/${name}.yml`);
      expect(workflow).toMatch(/branches: \[release\]/);
      expect(workflow).toContain('run: npm run lint');
      expect(workflow).toContain('run: npm test');
    });
  }
});
