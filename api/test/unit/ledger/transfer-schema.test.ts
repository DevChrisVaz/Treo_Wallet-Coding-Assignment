import { describe, expect, it } from 'vitest';
import {
  createTransferRequestSchema,
  parseIdempotencyKey,
} from '../../../src/modules/transfers/infrastructure/http/schemas.js';
import { parseInput } from '../../../src/platform/http/validation.js';
import { DomainError } from '../../../src/shared/errors.js';

const FROM = '11111111-1111-4111-8111-111111111111';
const TO = '22222222-2222-4222-8222-222222222222';
const valid = {
  fromAccountId: FROM,
  destination: { type: 'BENEFICIARY', beneficiaryId: TO },
  amount: '1250.5',
  concept: 'Renta',
  reference: '1234567',
};

function errors(input: Record<string, unknown>) {
  try {
    parseInput(createTransferRequestSchema, input);
  } catch (error) {
    if (error instanceof DomainError) return error.extensions.errors ?? [];
    throw error;
  }
  return [];
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
    return 'OK';
  } catch (error) {
    return error instanceof DomainError ? error.code : String(error);
  }
}

describe('TRF-08 y TRF-09 esquema de CreateTransferRequest', () => {
  it('TRF-08 interpreta el monto en centavos y la referencia como número', () => {
    const parsed = parseInput(createTransferRequestSchema, valid);
    expect(parsed.amount.cents).toBe(125050n);
    expect(parsed.reference).toBe(1234567);
    expect(parsed.destination).toEqual({ type: 'BENEFICIARY', id: TO });
  });

  it('TRF-08 el destino OWN_ACCOUNT lleva accountId', () => {
    const parsed = parseInput(createTransferRequestSchema, {
      ...valid,
      destination: { type: 'OWN_ACCOUNT', accountId: TO },
    });
    expect(parsed.destination).toEqual({ type: 'OWN_ACCOUNT', id: TO });
  });

  it.each([
    ['más de dos decimales', '100.005', 'TOO_MANY_DECIMALS'],
    ['cero', '0.00', 'NOT_POSITIVE'],
    ['número JSON', 1250.5, 'INVALID_TYPE'],
    ['separador de miles', '1,250.50', 'INVALID_FORMAT'],
  ])('TRF-08 un monto con %s se rechaza en /amount sin redondear', (_case, amount, code) => {
    expect(errors({ ...valid, amount })).toEqual([
      { pointer: '/amount', code, message: expect.any(String) },
    ]);
  });

  it('TRF-09 una referencia con letras se señala en /reference', () => {
    expect(errors({ ...valid, reference: '12A' })).toEqual([
      { pointer: '/reference', code: 'INVALID_FORMAT', message: expect.any(String) },
    ]);
  });

  it.each([
    ['vacío', '', 'REQUIRED'],
    ['de 41 caracteres', 'a'.repeat(41), 'TOO_LONG'],
    ['con espacios en los extremos', ' Renta ', 'INVALID_FORMAT'],
  ])('TRF-09 un concepto %s se señala en /concept', (_case, concept, code) => {
    expect(errors({ ...valid, concept })).toEqual([
      { pointer: '/concept', code, message: expect.any(String) },
    ]);
  });

  it.each([
    ['sin tipo', { beneficiaryId: TO }, '/destination/type'],
    ['con tipo desconocido', { type: 'CLABE', beneficiaryId: TO }, '/destination/type'],
    [
      'OWN_ACCOUNT con beneficiaryId',
      { type: 'OWN_ACCOUNT', beneficiaryId: TO },
      '/destination/accountId',
    ],
    ['BENEFICIARY sin id', { type: 'BENEFICIARY' }, '/destination/beneficiaryId'],
    [
      'con un id que no es UUID',
      { type: 'BENEFICIARY', beneficiaryId: 'x' },
      '/destination/beneficiaryId',
    ],
  ])('TRF-06 un destino %s se rechaza con su JSON Pointer', (_case, destination, pointer) => {
    expect(errors({ ...valid, destination }).map((error) => error.pointer)).toContain(pointer);
  });

  it('TRF-06 un destino OWN_ACCOUNT con un campo de más lo señala como no declarado', () => {
    expect(
      errors({ ...valid, destination: { type: 'OWN_ACCOUNT', accountId: TO, beneficiaryId: TO } }),
    ).toEqual([
      expect.objectContaining({ pointer: '/destination/beneficiaryId', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('TRF-06 fromAccountId debe ser un UUID', () => {
    expect(errors({ ...valid, fromAccountId: 'abc' })).toEqual([
      expect.objectContaining({ pointer: '/fromAccountId', code: 'INVALID_FORMAT' }),
    ]);
  });
});

describe('TRF-02 llave de idempotencia', () => {
  it('TRF-02 sin header responde 400 IDEMPOTENCY_KEY_MISSING', () => {
    expect(codeOf(() => parseIdempotencyKey(undefined))).toBe('IDEMPOTENCY_KEY_MISSING');
    expect(codeOf(() => parseIdempotencyKey(''))).toBe('IDEMPOTENCY_KEY_MISSING');
  });

  it('TRF-02 un valor que no es UUID responde 400 IDEMPOTENCY_KEY_INVALID', () => {
    expect(codeOf(() => parseIdempotencyKey('mi-llave'))).toBe('IDEMPOTENCY_KEY_INVALID');
  });

  it('TRF-02 un UUID se acepta en minúsculas', () => {
    expect(parseIdempotencyKey('6F1C1D4E-0D55-4A7A-9F4B-2B8C9D1E2F3A')).toBe(
      '6f1c1d4e-0d55-4a7a-9f4b-2b8c9d1e2f3a',
    );
  });
});
