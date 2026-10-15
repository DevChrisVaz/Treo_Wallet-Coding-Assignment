import type { MovementType } from '../../transfers/domain/ledger.js';
import type { CursorPosition } from './cursor.js';

/** Consulta de una página del historial ya traducida a instantes UTC. */
export interface MovementPageQuery {
  readonly accountId: string;
  /** Inicio inclusivo (medianoche de CDMX del día `from`). */
  readonly start?: Date | undefined;
  /** Fin exclusivo (medianoche de CDMX del día siguiente a `to`). */
  readonly endExclusive?: Date | undefined;
  /** Vacío: todos los tipos. */
  readonly types: readonly MovementType[];
  /** Último movimiento de la página anterior: se devuelve lo estrictamente anterior a él. */
  readonly after?: CursorPosition | undefined;
  /** Filas a leer. */
  readonly limit: number;
}

/** Un asiento del ledger con lo necesario para mostrarlo como movimiento (HIS-03). */
export interface MovementRecord {
  readonly id: string;
  readonly type: MovementType;
  readonly amountCents: bigint;
  readonly balanceAfterCents: bigint;
  /** ISO 8601 UTC con microsegundos: la posición exacta para el cursor. */
  readonly occurredAt: string;
  readonly transferId: string;
  readonly concept: string;
  readonly reference: number | null;
  readonly counterparty: { readonly name: string; readonly clabeLast4: string | null } | null;
}

export interface MovementReader {
  page(query: MovementPageQuery): Promise<MovementRecord[]>;
}
