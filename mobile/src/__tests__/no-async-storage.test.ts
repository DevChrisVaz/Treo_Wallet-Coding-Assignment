/**
 * @jest-environment node
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import packageJson from '../../package.json';

const ROOT = join(__dirname, '..', '..');
const FORBIDDEN = '@react-native-async-storage/async-storage';
const SKIP = new Set(['node_modules', '.expo', 'dist', 'coverage', '.git']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

describe('AsyncStorage prohibido', () => {
  test('MOB-02 ningún módulo de la app importa AsyncStorage ni lo declara como dependencia', () => {
    const offenders = sourceFiles(ROOT)
      // Este archivo y la regla de ESLint nombran el paquete para prohibirlo.
      .filter((file) => file !== __filename && file !== join(ROOT, 'eslint.config.js'))
      .filter((file) => readFileSync(file, 'utf8').includes(FORBIDDEN))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
    const declared = { ...packageJson.dependencies, ...packageJson.devDependencies };
    expect(Object.keys(declared)).not.toContain(FORBIDDEN);
  });

  // ESLint carga su configuración con import() dinámico, que el entorno de Jest no permite: se
  // ejecuta como lo haría el script lint, en un proceso aparte.
  function lint(code: string, filePath: string) {
    const result = spawnSync(
      process.execPath,
      [
        join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
        '--format',
        'json',
        '--stdin',
        '--stdin-filename',
        filePath,
      ],
      { cwd: ROOT, input: code, encoding: 'utf8' },
    );
    const [report] = JSON.parse(result.stdout) as {
      messages: { severity: number; message: string }[];
    }[];
    return { status: result.status, messages: report?.messages ?? [] };
  }

  test('MOB-02 ESLint rechaza importar AsyncStorage en cualquier archivo', () => {
    const esm = lint(
      `import AsyncStorage from '${FORBIDDEN}';\n`,
      'src/features/session/storage.ts',
    );
    const cjs = lint(`const storage = require('${FORBIDDEN}');\n`, 'src/legacy.js');
    for (const result of [esm, cjs]) {
      expect(result.status).toBe(1);
      expect(result.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 2,
            message: expect.stringContaining('expo-secure-store'),
          }),
        ]),
      );
    }
  }, 30_000);
});
