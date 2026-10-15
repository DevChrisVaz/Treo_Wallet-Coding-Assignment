import { curpCheckDigit } from '../../src/modules/identity/domain/curp.js';

let sequence = 0;
const run = Math.floor(Math.random() * 1e6)
  .toString(36)
  .padStart(4, '0');

/** El contador en letras (el nombre no admite dígitos): 1 → `B`, 27 → `BB`. */
function spelled(n: number): string {
  let rest = n;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  } while (rest > 0);
  return letters;
}

/**
 * Datos de registro válidos y únicos: CURP con dígito verificador calculado, RFC con fecha real y
 * teléfono de 10 dígitos, todos derivados de un contador para no chocar entre pruebas.
 */
export function newRegistration(overrides: Partial<Record<string, unknown>> = {}) {
  sequence += 1;
  const n = sequence;
  const birth = new Date(Date.UTC(1960, 0, 1) + n * 86_400_000 * 7);
  const yymmdd = `${String(birth.getUTCFullYear() % 100).padStart(2, '0')}${String(
    birth.getUTCMonth() + 1,
  ).padStart(2, '0')}${String(birth.getUTCDate()).padStart(2, '0')}`;
  const differentiator = String(n % 10);
  const first17 = `GOMC${yymmdd}HDFNLR${differentiator}`;
  const curp = `${first17}${curpCheckDigit(first17)}`;
  const rfc = `GOMC${yymmdd}A${String.fromCharCode(65 + (n % 26))}${n % 10}`;
  const phone = `55${String((n * 7919 + Number.parseInt(run, 36)) % 1e8).padStart(8, '0')}`;
  return {
    email: `persona${n}.${run}@example.com`,
    password: 'contraseña muy segura 2026',
    firstNames: 'Persona',
    paternalSurname: spelled(n),
    maternalSurname: 'Prueba',
    birthDate: birth.toISOString().slice(0, 10),
    birthState: 'DF',
    curp,
    rfc,
    phone,
    ...overrides,
  };
}

export type Registration = ReturnType<typeof newRegistration>;
