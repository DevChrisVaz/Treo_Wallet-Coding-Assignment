import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MovementCursor,
  type MovementFilters,
} from '../../../src/modules/movements/application/cursor.js';
import { DomainError } from '../../../src/shared/errors.js';

const secret = Buffer.alloc(32, 17);
const cursors = new MovementCursor(secret);
const filters: MovementFilters = {
  accountId: '11111111-1111-4111-8111-111111111111',
  from: '2026-09-01',
  to: '2026-09-30',
  types: ['TRANSFER_OUT'],
};
const position = { occurredAt: '2026-09-15T18:30:00.123456Z', id: '987654321' };

function codeOf(fn: () => unknown): string {
  try {
    fn();
    return 'OK';
  } catch (error) {
    return error instanceof DomainError ? error.code : String(error);
  }
}

describe('HIS-05 cursor opaco y firmado', () => {
  it('HIS-05 el cursor devuelve la misma posición con los mismos filtros', () => {
    const cursor = cursors.encode(position, filters);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(cursor.length).toBeLessThanOrEqual(512);
    expect(cursors.decode(cursor, filters)).toEqual(position);
  });

  it('HIS-07 el orden de los tipos no cambia los filtros', () => {
    const two: MovementFilters = { ...filters, types: ['DEPOSIT', 'TRANSFER_IN'] };
    const cursor = cursors.encode(position, two);
    expect(cursors.decode(cursor, { ...two, types: ['TRANSFER_IN', 'DEPOSIT'] })).toEqual(position);
  });

  it.each<[string, Partial<MovementFilters>]>([
    ['otro tipo', { types: ['DEPOSIT'] }],
    ['sin tipo', { types: [] }],
    ['otra fecha inicial', { from: '2026-08-01' }],
    ['sin fecha final', { to: undefined }],
    ['otra cuenta', { accountId: '22222222-2222-4222-8222-222222222222' }],
  ])('HIS-05 con %s responde 400 INVALID_CURSOR', (_case, change) => {
    const cursor = cursors.encode(position, filters);
    expect(codeOf(() => cursors.decode(cursor, { ...filters, ...change }))).toBe('INVALID_CURSOR');
  });

  it('HIS-05 un cursor alterado en cualquier carácter responde INVALID_CURSOR', () => {
    const cursor = cursors.encode(position, filters);
    for (let i = 0; i < cursor.length; i++) {
      if (cursor[i] === '.') continue;
      const replacement = cursor[i] === 'A' ? 'B' : 'A';
      const altered = cursor.slice(0, i) + replacement + cursor.slice(i + 1);
      expect(codeOf(() => cursors.decode(altered, filters))).toBe('INVALID_CURSOR');
    }
  });

  it('HIS-05 cambiar los bits sobrantes del último carácter de la firma también es alterarlo', () => {
    // 32 bytes en base64url son 43 caracteres con 2 bits sin usar al final: decodificar y comparar
    // bytes aceptaría este cursor modificado a mano.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const cursor = cursors.encode(position, filters);
    const last = alphabet.indexOf(cursor.at(-1) ?? '');
    const altered = cursor.slice(0, -1) + alphabet[last ^ 1];
    expect(Buffer.from(altered.split('.')[1] ?? '', 'base64url')).toEqual(
      Buffer.from(cursor.split('.')[1] ?? '', 'base64url'),
    );
    expect(codeOf(() => cursors.decode(altered, filters))).toBe('INVALID_CURSOR');
  });

  it('HIS-05 un cursor con otra posición pero firmado con otro secreto responde INVALID_CURSOR', () => {
    const forged = new MovementCursor(Buffer.alloc(32, 99)).encode(
      { occurredAt: '2026-09-30T00:00:00.000000Z', id: '1' },
      filters,
    );
    expect(codeOf(() => cursors.decode(forged, filters))).toBe('INVALID_CURSOR');
  });

  it('HIS-05 una carga bien firmada pero con campos inválidos responde INVALID_CURSOR', () => {
    const sign = (payload: unknown) => {
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const mac = createHmac('sha256', secret).update(body).digest('base64url');
      return `${body}.${mac}`;
    };
    const valid = cursors.encode(position, filters);
    const [body] = valid.split('.');
    const f = JSON.parse(Buffer.from(body ?? '', 'base64url').toString()).f;
    expect(codeOf(() => cursors.decode(sign({ t: 'ayer', id: '1', f }), filters))).toBe(
      'INVALID_CURSOR',
    );
    expect(
      codeOf(() => cursors.decode(sign({ t: position.occurredAt, id: '1; DROP', f }), filters)),
    ).toBe('INVALID_CURSOR');
    expect(codeOf(() => cursors.decode(sign([1, 2, 3]), filters))).toBe('INVALID_CURSOR');
  });

  it.each(['', 'abc', 'a.b', '.', '...', 'eyJ0IjoxfQ'])(
    'HIS-05 "%s" no es un cursor: INVALID_CURSOR',
    (garbage) => {
      expect(codeOf(() => cursors.decode(garbage, filters))).toBe('INVALID_CURSOR');
    },
  );
});
