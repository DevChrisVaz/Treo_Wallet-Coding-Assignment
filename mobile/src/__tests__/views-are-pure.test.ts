/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FEATURES = join(__dirname, '..', 'features');
/** Lo que una vista no puede importar (salvo `import type`): navegación, consultas, sesión, nativos. */
const IMPURE =
  /^import\s+(?!type\b)[^;]*?from\s+'(expo-[^']*|@tanstack\/react-query|@react-native-community\/netinfo|@\/app-services|@\/session\/[^']*|@\/features\/[^']*\/queries|\.\/queries|\.\/transfer-attempt|\.\/use-transfer-attempt|\.\/transport|\.\/connectivity)'/m;

export function viewFiles(dir: string = FEATURES): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : viewFiles(join(dir, entry.name));
    return entry.name.endsWith('-view.tsx') ? [join(dir, entry.name)] : [];
  });
}

/** Vistas del flujo de transferencia que aún usan el router o el intento; la tarea 7.5 las vuelve puras y vacía esta lista. */
const PENDING_7_5 = ['transfer/otp-view.tsx', 'transfer/outcome-view.tsx'];

describe('vistas de pantalla puras', () => {
  test('MOB-18 MOB-22 ninguna vista importa navegación, consultas, sesión ni módulos nativos', () => {
    const files = viewFiles();
    // Sin vistas encontradas la revisión pasaría sin revisar nada (p. ej., si cambia la carpeta).
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter((file) => !PENDING_7_5.some((pending) => file.endsWith(pending)))
      .filter((file) => IMPURE.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
