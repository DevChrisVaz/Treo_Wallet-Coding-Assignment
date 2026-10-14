import { describe, expect, it } from 'vitest';
import { createBeneficiaryRequestSchema } from '../../../src/modules/beneficiaries/infrastructure/http/schemas.js';
import { parseInput } from '../../../src/platform/http/validation.js';
import { DomainError } from '../../../src/shared/errors.js';

const valid = { name: 'Luis Pérez', alias: 'Luis', clabe: '032180000118359719' };

function errors(input: Record<string, unknown>) {
  try {
    parseInput(createBeneficiaryRequestSchema, input);
  } catch (error) {
    if (error instanceof DomainError) return error.extensions.errors ?? [];
    throw error;
  }
  return [];
}

describe('BEN-02 formato de los datos del beneficiario', () => {
  it('BEN-02 acepta nombre, alias y una CLABE de 18 dígitos', () => {
    expect(parseInput(createBeneficiaryRequestSchema, valid)).toEqual(valid);
  });

  it('BEN-02 una CLABE de 17 dígitos se señala en /clabe', () => {
    expect(errors({ ...valid, clabe: '03218000011835971' })).toEqual([
      { pointer: '/clabe', code: 'INVALID_FORMAT', message: expect.any(String) },
    ]);
  });

  it('BEN-02 una CLABE como número JSON es INVALID_TYPE', () => {
    expect(errors({ ...valid, clabe: 2180000118359719 })).toEqual([
      { pointer: '/clabe', code: 'INVALID_TYPE', message: expect.any(String) },
    ]);
  });

  it('BEN-02 el dígito verificador no es parte del formato: lo valida la regla de negocio', () => {
    expect(errors({ ...valid, clabe: '032180000118359718' })).toEqual([]);
  });

  it.each([
    ['nombre vacío', { name: '' }, '/name'],
    ['nombre de 101 caracteres', { name: 'a'.repeat(101) }, '/name'],
    ['alias de 31 caracteres', { alias: 'a'.repeat(31) }, '/alias'],
    ['alias con espacio al inicio', { alias: ' Luis' }, '/alias'],
    ['alias con espacio al final', { alias: 'Luis ' }, '/alias'],
    ['campo no declarado', { favorite: true }, '/favorite'],
  ])('BEN-02 %s se señala con su JSON Pointer', (_case, change, pointer) => {
    expect(errors({ ...valid, ...change }).map((error) => error.pointer)).toEqual([pointer]);
  });
});
