import { curpCheckDigit } from '../modules/identity/domain/curp.js';

/** Persona de datos demo: los mismos campos que pide el registro. */
export interface SeedPerson {
  readonly email: string;
  readonly password: string;
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  readonly curp: string;
  readonly rfc: string;
  readonly phone: string;
}

/** Contraseña común de los usuarios generados (documentada en el README; solo desarrollo). */
export const GENERATED_PASSWORD = 'Demo-usuario-2026!';

const FIRST_NAMES = [
  'María',
  'José',
  'Guadalupe',
  'Juan',
  'Verónica',
  'Francisco',
  'Patricia',
  'Carlos',
  'Alejandra',
  'Jorge',
  'Fernanda',
  'Ricardo',
  'Gabriela',
  'Miguel',
  'Daniela',
  'Roberto',
  'Sofía',
];
const LAST_NAMES = [
  'Hernández',
  'García',
  'Martínez',
  'López',
  'González',
  'Rodríguez',
  'Sánchez',
  'Ramírez',
  'Flores',
  'Torres',
  'Rivera',
  'Morales',
  'Ortiz',
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Personas sintéticas deterministas (HIS-10): CURP con estructura, fecha y dígito verificador
 * válidos, RFC con fecha real y teléfono de 10 dígitos, todos únicos por índice. No corresponden a
 * personas reales: las iniciales de la CURP (`SE` + dos letras por índice) no se derivan del nombre.
 */
export function generatedPeople(count: number): SeedPerson[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const first = FIRST_NAMES[i % FIRST_NAMES.length] ?? 'Persona';
    const last1 = LAST_NAMES[i % LAST_NAMES.length] ?? 'Demo';
    const last2 = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length] ?? 'Demo';
    const initials = `SE${LETTERS[i % 26]}${LETTERS[Math.floor(i / 26) % 26]}`;
    const birth = new Date(Date.UTC(1975, 0, 1) + i * 97 * 86_400_000);
    const yymmdd = `${String(birth.getUTCFullYear() % 100).padStart(2, '0')}${String(
      birth.getUTCMonth() + 1,
    ).padStart(2, '0')}${String(birth.getUTCDate()).padStart(2, '0')}`;
    const first17 = `${initials}${yymmdd}${i % 2 === 0 ? 'M' : 'H'}DFRRL0`;
    return {
      email: `usuario${String(n).padStart(2, '0')}@example.com`,
      password: GENERATED_PASSWORD,
      firstNames: first,
      paternalSurname: last1,
      maternalSurname: last2,
      curp: `${first17}${curpCheckDigit(first17)}`,
      rfc: `${initials}${yymmdd}SD${n % 10}`,
      phone: `+5255${String(20_000_000 + n).padStart(8, '0')}`,
    };
  });
}
