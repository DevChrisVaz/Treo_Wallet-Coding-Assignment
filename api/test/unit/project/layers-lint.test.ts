import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const eslint = new ESLint({ cwd: root });

/** Lintea código como si viviera en `relativePath` y devuelve los mensajes de imports prohibidos. */
async function restrictedImports(relativePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, relativePath) });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('PLT-18 dependencias entre capas', () => {
  it('PLT-18 el lint falla si un archivo de dominio importa Express', async () => {
    const messages = await restrictedImports(
      'src/modules/identity/domain/lint-fixture.ts',
      "import express from 'express';\nexport const app = express;\n",
    );
    expect(messages).toHaveLength(1);
  });

  it('PLT-18 el lint falla si un archivo de dominio importa TypeORM', async () => {
    const messages = await restrictedImports(
      'src/modules/accounts/domain/lint-fixture.ts',
      "import { DataSource } from 'typeorm';\nexport const source = DataSource;\n",
    );
    expect(messages).toHaveLength(1);
  });

  it('PLT-18 el lint falla si el dominio importa la capa de aplicación o de infraestructura', async () => {
    const messages = await restrictedImports(
      'src/modules/audit/domain/lint-fixture.ts',
      [
        "import { a } from '../application/use-case.js';",
        "import { b } from '../infrastructure/repository.js';",
        "import { c } from '../../../platform/http/app.js';",
        'export const all = [a, b, c];',
        '',
      ].join('\n'),
    );
    expect(messages).toHaveLength(3);
  });

  it('PLT-18 el lint falla si la capa de aplicación importa Express, TypeORM o adaptadores', async () => {
    const messages = await restrictedImports(
      'src/modules/identity/application/lint-fixture.ts',
      [
        "import express from 'express';",
        "import { DataSource } from 'typeorm';",
        "import { repo } from '../infrastructure/repository.js';",
        'export const all = [express, DataSource, repo];',
        '',
      ].join('\n'),
    );
    expect(messages).toHaveLength(3);
  });

  it('PLT-18 el dominio puede importar el núcleo compartido y otros dominios', async () => {
    const messages = await restrictedImports(
      'src/modules/identity/domain/lint-fixture.ts',
      [
        "import { DomainError } from '../../../shared/errors.js';",
        "import { clabe } from '../../accounts/domain/clabe.js';",
        'export const all = [DomainError, clabe];',
        '',
      ].join('\n'),
    );
    expect(messages).toEqual([]);
  });
});
