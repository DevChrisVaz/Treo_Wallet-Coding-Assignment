import type { MovementRecord } from '../../movements/application/ports.js';
import type { StatementPeriod } from '../domain/statement-period.js';
import type { ReconciledSummary } from '../domain/statement-summary.js';

/** La cuenta del estado de cuenta con lo que va en su encabezado (HIS-12). */
export interface StatementAccount {
  readonly id: string;
  readonly name: string;
  /** CLABE completa: el documento es para el titular. */
  readonly clabe: string;
  readonly holderName: string;
  /** Apertura de la cuenta: el primer mes de CDMX que se puede pedir (HIS-11). */
  readonly createdAt: Date;
}

/**
 * Lecturas de una sola instantánea de la base (D3): todas ven exactamente el mismo estado, así que
 * una transferencia que se confirma a mitad de la generación no aparece y el resumen cuadra.
 */
export interface StatementSnapshot {
  /**
   * La cuenta solo si existe, es USER y pertenece al usuario; una ajena, una inexistente y la
   * Tesorería dan el mismo `null` (ACC-06).
   */
  account(userId: string, accountId: string): Promise<StatementAccount | null>;
  /** `balanceAfter` del último asiento anterior a `start`, o 0 si no hay. */
  openingBalance(accountId: string, start: Date): Promise<bigint>;
  /**
   * Movimientos de `[start, endExclusive)` en orden ascendente por fecha y, en empate, por id, en
   * tandas: la base nunca entrega el mes de golpe.
   */
  movements(
    accountId: string,
    start: Date,
    endExclusive: Date,
  ): AsyncIterable<readonly MovementRecord[]>;
}

export interface StatementReader {
  /** Abre la instantánea, ejecuta el trabajo con ella y la cierra, falle o no. */
  withSnapshot<T>(work: (snapshot: StatementSnapshot) => Promise<T>): Promise<T>;
}

/** Lo que va en el encabezado del documento. */
export interface StatementHeader {
  readonly account: StatementAccount;
  readonly period: StatementPeriod;
}

/** Un documento en construcción: recibe las tandas y, al final, el resumen ya conciliado. */
export interface StatementDocument {
  /** Agrega renglones a la tabla, en el orden en que llegan. */
  addRows(rows: readonly MovementRecord[]): void;
  /** Escribe el resumen y los pies de página y devuelve los bytes del documento completo. */
  finish(summary: ReconciledSummary): Promise<Uint8Array>;
}

/** Genera el documento del estado de cuenta (HIS-12). */
export interface StatementRenderer {
  begin(header: StatementHeader): StatementDocument;
}
