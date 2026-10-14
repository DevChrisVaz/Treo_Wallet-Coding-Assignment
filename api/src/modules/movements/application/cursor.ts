import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../shared/errors.js';
import type { MovementType } from '../../transfers/domain/ledger.js';

/** Filtros con los que se obtuvo una página: el cursor solo sirve con los mismos. */
export interface MovementFilters {
  readonly accountId: string;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly types: readonly MovementType[];
}

/**
 * Posición del último movimiento de una página: su momento con microsegundos (la precisión de
 * `timestamptz`, para que la comparación keyset no salte ni repita filas) y su id.
 */
export interface CursorPosition {
  readonly occurredAt: string;
  readonly id: string;
}

const TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/;
const ENTRY_ID = /^[1-9][0-9]{0,18}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function invalidCursor(): DomainError {
  return new DomainError('INVALID_CURSOR', 'El cursor no es válido para esta consulta');
}

/**
 * Cursor opaco del historial (HIS-05): `base64url(JSON {t, id, f})` + `.` + HMAC-SHA256 en
 * base64url de esa carga, con `CURSOR_SIGNING_SECRET`. `f` es el hash de los filtros normalizados
 * (cuenta, fechas y tipos ordenados). Una firma que no coincide (cursor alterado o de otro secreto)
 * o un `f` distinto a los filtros actuales responde `400 INVALID_CURSOR`. La firma se compara como
 * texto, no decodificada, para que ningún carácter alterado pase inadvertido.
 */
export class MovementCursor {
  constructor(private readonly secret: Buffer) {}

  encode(position: CursorPosition, filters: MovementFilters): string {
    const body = Buffer.from(
      JSON.stringify({ t: position.occurredAt, id: position.id, f: this.filtersHash(filters) }),
    ).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  decode(cursor: string, filters: MovementFilters): CursorPosition {
    const parts = cursor.split('.');
    if (parts.length !== 2) throw invalidCursor();
    const [body = '', signature = ''] = parts;
    if (!BASE64URL.test(body) || !BASE64URL.test(signature)) throw invalidCursor();
    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw invalidCursor();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw invalidCursor();
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw invalidCursor();
    }
    const { t, id, f } = payload as Record<string, unknown>;
    if (
      typeof t !== 'string' ||
      !TIMESTAMP.test(t) ||
      Number.isNaN(Date.parse(t)) ||
      typeof id !== 'string' ||
      !ENTRY_ID.test(id) ||
      f !== this.filtersHash(filters)
    ) {
      throw invalidCursor();
    }
    return { occurredAt: t, id };
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private filtersHash(filters: MovementFilters): string {
    const normalized = JSON.stringify([
      filters.accountId.toLowerCase(),
      filters.from ?? null,
      filters.to ?? null,
      [...filters.types].sort(),
    ]);
    return createHash('sha256').update(normalized).digest('base64url').slice(0, 22);
  }
}
