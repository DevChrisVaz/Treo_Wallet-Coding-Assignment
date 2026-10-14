/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readme = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf8');

/** Texto de una sección `## ...` hasta la siguiente sección del mismo nivel. */
function sectionOf(heading: string): string {
  const start = readme.indexOf(`${heading}`);
  if (start === -1) return '';
  const next = readme.indexOf('\n## ', start + heading.length);
  return readme.slice(start, next === -1 ? undefined : next);
}

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

  test('MOB-24 documenta el desbloqueo biométrico, su comportamiento en Expo Go y su alcance de seguridad', () => {
    const section = sectionOf('## Desbloqueo biométrico');
    expect(section).toContain('expo-local-authentication');
    expect(section).toContain('Entrar con tu huella');
    expect(section).toContain('Desbloqueo con huella');
    expect(section).toContain('60 segundos');
    expect(section).toContain('Usar mi contraseña');
    // Expo Go: huella en Android sí; Face ID en iOS necesita un development build.
    expect(section).toMatch(/Android[^\n]*huella[^\n]*Expo Go/);
    expect(section).toMatch(/Face ID[^\n]*development build/);
    expect(section).toContain('NSFaceIDUsageDescription');
    // Alcance: puerta de la interfaz; el seguimiento ata el refresh a la biometría.
    expect(section).toMatch(/puerta de la interfaz/);
    expect(section).toContain('requireAuthentication');
  });

  test('MOB-25 incluye el guion de verificación manual del desbloqueo en un Android con huella', () => {
    const section = sectionOf('## Verificación manual del desbloqueo biométrico');
    for (const step of [
      'Activar',
      'Cierra la app',
      'menos de 60 segundos',
      'más de 60 segundos',
      'Cancela el diálogo',
      'Usar mi contraseña',
      'Apaga el interruptor',
      '/auth/refresh',
    ]) {
      expect(section).toContain(step);
    }
  });

  test('MOB-17 explica la instalación de los paquetes locales, las pruebas y lo pendiente', () => {
    expect(readme).toContain('install-links=true');
    expect(readme).toContain('npm test');
    expect(readme).toMatch(/Qué haría con más tiempo/);
    expect(readme).toMatch(/biométric/i);
    expect(readme).toMatch(/Verificación manual en Expo Go/);
  });
});
