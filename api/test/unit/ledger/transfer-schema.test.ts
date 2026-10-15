import { toFieldErrors as contractFieldErrors, transferForm } from '@devchrisvaz/wallet-contract';
import { describe, expect, it } from 'vitest';
import {
  createTransferRequestSchema,
  parseIdempotencyKey,
} from '../../../src/modules/transfers/infrastructure/http/schemas.js';
import { parseInput, toFieldErrors } from '../../../src/platform/http/validation.js';
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

  it.each([
    ['ausente', undefined],
    ['cadena vacía', ''],
  ])(
    'TRF-09 una referencia %s es opcional y se interpreta como null (sin referencia)',
    (_case, reference) => {
      const { reference: _omit, ...rest } = valid;
      const parsed = parseInput(createTransferRequestSchema, {
        ...rest,
        ...(reference === undefined ? {} : { reference }),
      });
      expect(parsed.reference).toBeNull();
    },
  );

  it.each([
    ['8 dígitos', '12345678', 'TOO_LONG'],
    ['símbolos', '12-3', 'INVALID_FORMAT'],
    ['número JSON', 123, 'INVALID_TYPE'],
  ])('TRF-09 una referencia con %s se señala en /reference', (_case, reference, code) => {
    expect(errors({ ...valid, reference })).toEqual([
      { pointer: '/reference', code, message: expect.any(String) },
    ]);
  });

  it.each([
    ['con letras', '12A'],
    ['con símbolos', '$1.50'],
    ['con 3 decimales', '100.005'],
    ['con separador de miles', '1,250'],
    ['en notación científica', '1e3'],
  ])('TRF-08 un monto %s se rechaza en /amount', (_case, amount) => {
    expect(errors({ ...valid, amount })).toEqual([
      { pointer: '/amount', code: expect.any(String), message: expect.any(String) },
    ]);
  });

  it('TRF-27 interpreta scheduledFor como instante (Date) con cualquier desfase', () => {
    const parsed = parseInput(createTransferRequestSchema, {
      ...valid,
      scheduledFor: '2026-10-20T14:30:00-06:00',
    });
    expect(parsed.scheduledFor?.toISOString()).toBe('2026-10-20T20:30:00.000Z');
  });

  it.each([
    ['solo fecha', '2026-10-20'],
    ['sin desfase', '2026-10-20T14:30:00'],
    ['con segundos', '2026-10-20T14:30:15-06:00'],
    ['con milisegundos', '2026-10-20T14:30:00.500Z'],
    ['inexistente', '2026-02-30T14:30:00Z'],
  ])('TRF-27 scheduledFor %s se rechaza en /scheduledFor', (_case, scheduledFor) => {
    expect(errors({ ...valid, scheduledFor })).toEqual([
      { pointer: '/scheduledFor', code: 'INVALID_FORMAT', message: expect.any(String) },
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

const payloads: [string, unknown][] = [
  ['válido', valid],
  ['sin referencia', { ...valid, reference: undefined }],
  ['referencia vacía', { ...valid, reference: '' }],
  ['OWN_ACCOUNT', { ...valid, destination: { type: 'OWN_ACCOUNT', accountId: TO } }],
  ['UUID en mayúsculas', { ...valid, fromAccountId: FROM.toUpperCase() }],
  ['campo no declarado', { ...valid, extra: 1 }],
  ['cuerpo vacío', {}],
  ['fromAccountId vacío', { ...valid, fromAccountId: '' }],
  ['fromAccountId numérico', { ...valid, fromAccountId: 5 }],
  ['sin destino', { ...valid, destination: undefined }],
  ['destino que no es objeto', { ...valid, destination: 'x' }],
  ['destino sin tipo', { ...valid, destination: { beneficiaryId: TO } }],
  ['destino con tipo desconocido', { ...valid, destination: { type: 'X', beneficiaryId: TO } }],
  [
    'OWN_ACCOUNT con beneficiaryId',
    { ...valid, destination: { type: 'OWN_ACCOUNT', beneficiaryId: TO } },
  ],
  ['BENEFICIARY sin id', { ...valid, destination: { type: 'BENEFICIARY' } }],
  [
    'destino con id que no es UUID',
    { ...valid, destination: { type: 'OWN_ACCOUNT', accountId: 'x' } },
  ],
  ['monto vacío', { ...valid, amount: '' }],
  ['monto con 3 decimales', { ...valid, amount: '100.005' }],
  ['monto cero', { ...valid, amount: '0' }],
  ['monto enorme', { ...valid, amount: '1000000000000' }],
  ['monto numérico', { ...valid, amount: 10 }],
  ['concepto vacío', { ...valid, concept: '' }],
  ['concepto largo', { ...valid, concept: 'a'.repeat(41) }],
  ['concepto con espacios', { ...valid, concept: ' a ' }],
  ['referencia larga', { ...valid, reference: '12345678' }],
  ['referencia con letras', { ...valid, reference: '1a' }],
  ['referencia nula', { ...valid, reference: null }],
  ['scheduledFor válido', { ...valid, scheduledFor: '2026-10-20T14:30:00Z' }],
  ['scheduledFor vacío', { ...valid, scheduledFor: '' }],
  ['scheduledFor con segundos', { ...valid, scheduledFor: '2026-10-20T14:30:15Z' }],
  ['scheduledFor inexistente', { ...valid, scheduledFor: '2026-02-30T14:30:00Z' }],
];

describe('TRF-08 y TRF-09 validación compartida con el contrato', () => {
  it.each(payloads)(
    'TRF-09 la API y transferForm del contrato aceptan o rechazan igual: %s',
    (_case, body) => {
      const shared = transferForm.safeParse(body);
      const api = createTransferRequestSchema.safeParse(body);

      expect(api.success).toBe(shared.success);
      if (!shared.success && !api.success) {
        expect(toFieldErrors(api.error)).toEqual(contractFieldErrors(shared.error));
      }
    },
  );
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
