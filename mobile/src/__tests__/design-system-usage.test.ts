/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');

function appFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'test-utils' ? [] : appFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'color hexadecimal', pattern: /['"`]#[0-9A-Fa-f]{3,8}['"`]/ },
  { name: 'color rgb()/hsl()', pattern: /\b(rgba?|hsla?)\(/ },
  { name: 'fontWeight (cada peso es su propia familia)', pattern: /fontWeight/ },
  { name: 'tamaño de letra escrito a mano', pattern: /\b(fontSize|lineHeight):\s*\d/ },
  { name: 'familia tipográfica escrita a mano', pattern: /fontFamily:\s*['"`]/ },
  {
    name: 'espaciado o radio escrito a mano',
    pattern: /\b(padding\w*|margin\w*|gap|rowGap|columnGap|borderRadius|border\w+Radius):\s*[1-9]/,
  },
];

describe('estilos solo con el sistema de diseño', () => {
  test('DSG-01 ningún archivo de la app define colores, tipografía, espaciados ni radios propios', () => {
    const violations = appFiles(SRC).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return RULES.filter(({ pattern }) => pattern.test(source)).map(
        ({ name }) => `${relative(SRC, file)}: ${name}`,
      );
    });
    expect(violations).toEqual([]);
  });

  test('DSG-03 ningún componente usa el verde de marca #31C454 como color de texto', () => {
    const offenders = appFiles(SRC).filter((file) =>
      /color:\s*theme\.colors\.accent\.brand/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
