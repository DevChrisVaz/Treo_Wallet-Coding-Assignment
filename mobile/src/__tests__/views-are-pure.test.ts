/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FEATURES = join(__dirname, '..', 'features');
/**
 * Lo que una vista no puede importar (salvo `import type`): navegación, consultas, sesión, nativos y,
 * en el desbloqueo, la biometría y la preferencia guardada.
 */
const IMPURE =
  /^import\s+(?!type\b)[^;]*?from\s+'(expo-[^']*|@tanstack\/react-query|@react-native-community\/netinfo|@\/app-services|@\/session\/[^']*|@\/features\/[^']*\/queries|\.\/queries|\.\/transfer-attempt|\.\/use-transfer-attempt|\.\/transport|\.\/connectivity|\.\/biometrics|\.\/use-unlock-preference)'/m;

export function viewFiles(dir: string = FEATURES): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return entry.name === '__tests__' ? [] : viewFiles(join(dir, entry.name));
    return entry.name.endsWith('-view.tsx') ? [join(dir, entry.name)] : [];
  });
}

describe('vistas de pantalla puras', () => {
  test('MOB-18 MOB-22 ninguna vista importa navegación, consultas, sesión ni módulos nativos', () => {
    const files = viewFiles();
    // Sin vistas encontradas la revisión pasaría sin revisar nada (p. ej., si cambia la carpeta).
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) => IMPURE.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  test('MOB-21 MOB-24 MOB-25 cada pantalla, y cada pieza del desbloqueo, tiene su vista pura', () => {
    expect(
      viewFiles()
        .map((file) => file.split('/features/')[1])
        .sort(),
    ).toEqual([
      'accounts/home-view.tsx',
      'accounts/movements-view.tsx',
      'auth/login-view.tsx',
      'transfer/form-view.tsx',
      'transfer/otp-view.tsx',
      'transfer/outcome-view.tsx',
      'transfer/recipient-view.tsx',
      'transfer/review-view.tsx',
      'transfer/transfer-flow-view.tsx',
      'unlock/lock-screen-view.tsx',
      'unlock/unlock-offer-view.tsx',
      'unlock/unlock-switch-view.tsx',
    ]);
  });
});
