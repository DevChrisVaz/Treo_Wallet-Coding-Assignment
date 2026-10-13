import { describe, expect, it } from 'vitest';
import { validateCurp } from '../../../src/modules/identity/domain/curp.js';
import { toE164 } from '../../../src/modules/identity/domain/phone.js';
import { validateRfc } from '../../../src/modules/identity/domain/rfc.js';
import { registerRequestSchema } from '../../../src/modules/identity/infrastructure/http/schemas.js';
import { parseInput } from '../../../src/platform/http/validation.js';
import { DomainError } from '../../../src/shared/errors.js';
import { normalizeEmail } from '../../../src/shared/email.js';
import { curpVectors, emailVectors, phoneVectors, rfcVectors } from '../../vectors/identity.js';

const validRegistration = {
  email: 'ana@example.com',
  password: 'contraseña larga 123',
  fullName: 'Ana Gómez',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

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
    ['11 caracteres', 'a'.repeat(11), 'TOO_SHORT'],
    ['129 caracteres', 'a'.repeat(129), 'TOO_LONG'],
  ])('IDN-02 contraseña de %s se señala en /password', (_case, password, code) => {
    expect(fieldErrors({ ...validRegistration, password })).toEqual([
      { pointer: '/password', code, message: expect.any(String) },
    ]);
  });

  it('IDN-02 acepta contraseñas de 12 y 128 caracteres sin reglas de composición', () => {
    expect(fieldErrors({ ...validRegistration, password: 'a'.repeat(12) })).toEqual([]);
    expect(fieldErrors({ ...validRegistration, password: 'ñ'.repeat(128) })).toEqual([]);
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
