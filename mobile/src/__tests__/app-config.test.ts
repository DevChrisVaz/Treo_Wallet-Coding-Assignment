import appJson from '../../app.json';
import packageJson from '../../package.json';
import tsconfig from '../../tsconfig.json';

describe('configuración del proyecto', () => {
  test('MOB-17 la app se identifica como TreoWallet y navega con Expo Router', () => {
    expect(appJson.expo.name).toBe('TreoWallet');
    expect(appJson.expo.slug).toBe('treowallet');
    expect(appJson.expo.scheme).toBe('treowallet');
    expect(appJson.expo.plugins).toContain('expo-router');
    expect(packageJson.main).toBe('expo-router/entry');
  });

  test('MOB-24 declara expo-local-authentication del SDK 57 con su plugin y el texto de Face ID', () => {
    expect(packageJson.dependencies).toHaveProperty(
      'expo-local-authentication',
      expect.stringMatching(/^~57\./),
    );
    expect(appJson.expo.plugins).toContainEqual([
      'expo-local-authentication',
      { faceIDPermission: expect.stringContaining('Face ID') },
    ]);
  });

  test('MOB-17 TypeScript es estricto y el proyecto tiene lint, typecheck, formato y pruebas', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
        test: 'jest',
        'format:check': 'prettier --check .',
      }),
    );
  });
});
