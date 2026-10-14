/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readme = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf8');

describe('README de /mobile', () => {
  test('MOB-17 documenta cómo apuntar a la API local sin cambiar código', () => {
    expect(readme).toContain('EXPO_PUBLIC_API_URL');
    expect(readme).toContain('http://10.0.2.2:4000');
    expect(readme).toMatch(/IP de (tu|la) red local/);
    expect(readme).toContain('.env.example');
  });

  test('MOB-17 documenta cómo leer los OTP en Mailpit', () => {
    expect(readme).toContain('Mailpit');
    expect(readme).toContain('http://localhost:8025');
  });

  test('MOB-17 explica la instalación de los paquetes locales, las pruebas y lo pendiente', () => {
    expect(readme).toContain('install-links=true');
    expect(readme).toContain('npm test');
    expect(readme).toMatch(/Qué haría con más tiempo/);
    expect(readme).toMatch(/biométric/i);
    expect(readme).toMatch(/Verificación manual en Expo Go/);
  });
});
