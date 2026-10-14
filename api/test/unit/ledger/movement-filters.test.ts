import { describe, expect, it } from 'vitest';
import { movementQuerySchema } from '../../../src/modules/movements/infrastructure/http/schemas.js';
import { parseInput } from '../../../src/platform/http/validation.js';
import { DomainError } from '../../../src/shared/errors.js';

function errors(query: Record<string, unknown>) {
  try {
    parseInput(movementQuerySchema, query);
  } catch (error) {
    if (error instanceof DomainError) {
      expect(error.code).toBe('VALIDATION_FAILED');
      return error.extensions.errors ?? [];
    }
    throw error;
  }
  return [];
}

describe('HIS-04 y HIS-07 filtros del historial', () => {
  it('HIS-08 sin parámetros: limit 20, todos los tipos y sin fechas ni cursor', () => {
    expect(parseInput(movementQuerySchema, {})).toEqual({ limit: 20, types: [] });
  });

  it('HIS-07 un tipo como string o varios repitiendo el parámetro', () => {
    expect(parseInput(movementQuerySchema, { type: 'DEPOSIT' }).types).toEqual(['DEPOSIT']);
    expect(parseInput(movementQuerySchema, { type: ['TRANSFER_IN', 'DEPOSIT'] }).types).toEqual([
      'TRANSFER_IN',
      'DEPOSIT',
    ]);
  });

  it('HIS-07 un tipo desconocido o repetido es 422 en /type', () => {
    expect(errors({ type: 'WITHDRAWAL' })).toEqual([
      expect.objectContaining({ pointer: '/type', code: 'INVALID_FORMAT' }),
    ]);
    expect(errors({ type: ['DEPOSIT', 'DEPOSIT'] })).toEqual([
      expect.objectContaining({ pointer: '/type', code: 'INVALID_FORMAT' }),
    ]);
  });

  it('HIS-04 limit admite de 1 a 100', () => {
    expect(parseInput(movementQuerySchema, { limit: '1' }).limit).toBe(1);
    expect(parseInput(movementQuerySchema, { limit: '100' }).limit).toBe(100);
  });

  it.each(['0', '101', 'abc', '1.5', '-1', '', '1e2'])(
    'HIS-04 limit "%s" es 422 en /limit',
    (limit) => {
      expect(errors({ limit })).toEqual([expect.objectContaining({ pointer: '/limit' })]);
    },
  );

  it('HIS-04 un parámetro escalar repetido es 422 INVALID_TYPE', () => {
    expect(errors({ limit: ['10', '20'] })).toEqual([
      expect.objectContaining({ pointer: '/limit', code: 'INVALID_TYPE' }),
    ]);
  });

  it('HIS-04 un parámetro desconocido es 422 UNKNOWN_FIELD', () => {
    expect(errors({ types: 'DEPOSIT' })).toEqual([
      expect.objectContaining({ pointer: '/types', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('HIS-05 el cursor es texto de hasta 512 caracteres', () => {
    expect(parseInput(movementQuerySchema, { cursor: 'abc' }).cursor).toBe('abc');
    expect(errors({ cursor: 'a'.repeat(513) })).toEqual([
      expect.objectContaining({ pointer: '/cursor', code: 'TOO_LONG' }),
    ]);
  });
});

describe('HIS-06 fechas del historial', () => {
  it('HIS-06 from y to son fechas calendario y pueden ser el mismo día', () => {
    expect(parseInput(movementQuerySchema, { from: '2026-09-30', to: '2026-09-30' })).toMatchObject(
      { from: '2026-09-30', to: '2026-09-30' },
    );
  });

  it.each(['2026-02-30', '2026-13-01', '30-09-2026', '2026-9-30', '2026-09-30T00:00:00Z'])(
    'HIS-06 "%s" no es una fecha válida: 422 en /from',
    (from) => {
      expect(errors({ from })).toEqual([expect.objectContaining({ pointer: '/from' })]);
    },
  );

  it('HIS-06 from posterior a to es 422 VALIDATION_FAILED', () => {
    expect(errors({ from: '2026-10-10', to: '2026-10-01' })).toEqual([
      expect.objectContaining({ pointer: '/to', code: 'INVALID_DATE' }),
    ]);
  });
});
