import { describe, expect, it } from 'vitest';
import { curpCheckDigit, validateCurp } from '../../../src/modules/identity/domain/curp.js';
import { toE164 } from '../../../src/modules/identity/domain/phone.js';
import { validateRfc } from '../../../src/modules/identity/domain/rfc.js';
import { registerRequestSchemaAt } from '../../../src/modules/identity/infrastructure/http/schemas.js';
import { parseInput } from '../../../src/platform/http/validation.js';
import { DomainError } from '../../../src/shared/errors.js';
import { normalizeEmail } from '../../../src/shared/email.js';
import { curpVectors, emailVectors, phoneVectors, rfcVectors } from '../../vectors/identity.js';

/** «Hoy» fijo (CDMX: 14 de octubre de 2026): la mayoría de edad se calcula contra este día. */
const NOW = new Date('2026-10-14T18:00:00.000Z');
const registerRequestSchema = registerRequestSchemaAt(NOW);

const validRegistration = {
  email: 'ana@example.com',
  password: 'contraseña larga 123',
  fullName: 'Ana Gómez',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

/** CURP y RFC coherentes (primeros 10 caracteres iguales) de alguien nacido en 20`yymmdd`. */
function identityBornOn(yymmdd: string) {
  const first17 = `GOMC${yymmdd}HDFNLRA`;
  return { curp: `${first17}${curpCheckDigit(first17)}`, rfc: `GOMC${yymmdd}AB1` };
}

function fieldErrors(input: Record<string, unknown>) {
  try {
    parseInput(registerRequestSchema, input);
  } catch (error) {
    if (error instanceof DomainError) return error.extensions.errors ?? [];
    throw error;
  }
  return [];
}

describe('IDN-02 validadores de dominio', () => {
  it.each(curpVectors)('IDN-02 CURP $input → $result', ({ input, result }) => {
    expect(validateCurp(input)).toBe(result);
  });

  it.each(rfcVectors)('IDN-02 RFC $input → $result', ({ input, result }) => {
    expect(validateRfc(input)).toBe(result);
  });

  it.each(phoneVectors)('IDN-02 teléfono $input → $e164', ({ input, e164 }) => {
    expect(toE164(input)).toBe(e164);
  });

  it.each(emailVectors)('IDN-02 email "$input" → $normalized', ({ input, normalized }) => {
    expect(normalizeEmail(input)).toBe(normalized);
  });
});

describe('IDN-02 esquema del registro', () => {
  it('IDN-02 transforma los datos válidos: email normalizado y teléfono en E.164', () => {
    expect(
      parseInput(registerRequestSchema, { ...validRegistration, email: '  Ana@Example.COM ' }),
    ).toEqual({
      ...validRegistration,
      phone: '+525512345678',
    });
  });

  it('IDN-02 CURP con dígito verificador incorrecto se señala en /curp', () => {
    expect(fieldErrors({ ...validRegistration, curp: 'GOMC900101HDFNLR08' })).toEqual([
      { pointer: '/curp', code: 'INVALID_CHECK_DIGIT', message: expect.any(String) },
    ]);
  });

  it('IDN-02 RFC con fecha imposible (990231) se señala en /rfc', () => {
    expect(fieldErrors({ ...validRegistration, rfc: 'GOMC990231AB1' })).toEqual([
      { pointer: '/rfc', code: 'INVALID_DATE', message: expect.any(String) },
    ]);
  });

  it.each([
    ['11 caracteres', 'a1'.repeat(5) + 'b', 'TOO_SHORT'],
    ['129 caracteres', 'a1'.repeat(64) + 'b', 'TOO_LONG'],
  ])('IDN-02 contraseña de %s se señala en /password', (_case, password, code) => {
    expect(fieldErrors({ ...validRegistration, password })).toEqual([
      { pointer: '/password', code, message: expect.any(String) },
    ]);
  });

  it('IDN-02 acepta contraseñas de 12 y 128 caracteres con letra y dígito', () => {
    expect(fieldErrors({ ...validRegistration, password: 'a'.repeat(11) + '1' })).toEqual([]);
    expect(fieldErrors({ ...validRegistration, password: 'ñ'.repeat(127) + '1' })).toEqual([]);
  });

  it.each([
    ['sin dígito', 'solo letras largas'],
    ['sin letra', '123456789012'],
  ])('IDN-02 contraseña %s se rechaza en /password', (_case, password) => {
    expect(fieldErrors({ ...validRegistration, password })).toEqual([
      { pointer: '/password', code: 'INVALID_FORMAT', message: expect.any(String) },
    ]);
  });

  it.each([
    ['con dígitos', 'Ana 2 Gómez'],
    ['con símbolos', 'Ana@ Gómez'],
    ['de una sola palabra', 'Ana'],
    ['con espacios repetidos', 'Ana  Gómez'],
    ['con espacio al inicio', ' Ana Gómez'],
  ])('IDN-02 nombre %s se rechaza en /fullName', (_case, fullName) => {
    expect(fieldErrors({ ...validRegistration, fullName })).toEqual([
      expect.objectContaining({ pointer: '/fullName', code: 'INVALID_FORMAT' }),
    ]);
  });

  it("IDN-02 acepta nombres con acentos, ñ, apóstrofo, guion y punto: 'María-José O'Brien Ñ.'", () => {
    expect(fieldErrors({ ...validRegistration, fullName: "María-José O'Brien Ñ." })).toEqual([]);
  });

  it.each(['0512345678', '1512345678', '551234567'])(
    'IDN-02 teléfono %s se rechaza en /phone',
    (phone) => {
      expect(fieldErrors({ ...validRegistration, phone })).toEqual([
        { pointer: '/phone', code: 'INVALID_FORMAT', message: expect.any(String) },
      ]);
    },
  );

  it('IDN-02 una CURP de quien cumple 18 mañana se rechaza en /curp con DATE_OUT_OF_RANGE', () => {
    const { curp, rfc } = identityBornOn('081015');
    expect(fieldErrors({ ...validRegistration, curp, rfc })).toEqual([
      { pointer: '/curp', code: 'DATE_OUT_OF_RANGE', message: expect.any(String) },
    ]);
  });

  it('IDN-02 una CURP de quien cumple 18 hoy (en CDMX) se acepta', () => {
    const { curp, rfc } = identityBornOn('081014');
    expect(fieldErrors({ ...validRegistration, curp, rfc })).toEqual([]);
  });

  it('IDN-02 una CURP con fecha de nacimiento futura se rechaza en /curp con INVALID_DATE', () => {
    const { curp, rfc } = identityBornOn('301014');
    expect(fieldErrors({ ...validRegistration, curp, rfc })).toEqual([
      { pointer: '/curp', code: 'INVALID_DATE', message: expect.any(String) },
    ]);
  });

  it('IDN-02 un RFC que no coincide con la CURP se rechaza en /rfc con "El RFC no coincide con tu CURP"', () => {
    expect(fieldErrors({ ...validRegistration, rfc: 'PEPE900101AB1' })).toEqual([
      { pointer: '/rfc', code: 'INVALID_FORMAT', message: 'El RFC no coincide con tu CURP' },
    ]);
  });

  it('IDN-02 exige todos los campos y rechaza los no declarados', () => {
    expect(fieldErrors({ referral: 'x' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: '/email', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/password', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/fullName', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/curp', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/rfc', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/phone', code: 'REQUIRED' }),
        expect.objectContaining({ pointer: '/referral', code: 'UNKNOWN_FIELD' }),
      ]),
    );
  });

  it('IDN-02 un teléfono numérico (número JSON) es INVALID_TYPE', () => {
    expect(fieldErrors({ ...validRegistration, phone: 5512345678 })).toEqual([
      { pointer: '/phone', code: 'INVALID_TYPE', message: expect.any(String) },
    ]);
  });
});
