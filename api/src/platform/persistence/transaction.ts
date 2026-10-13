import type { DataSource, QueryRunner } from 'typeorm';
import type { Transaction, TransactionRunner } from '../../shared/transaction.js';

/**
 * Transacción manual sobre un `QueryRunner` de TypeORM, en `READ COMMITTED`. Los bloqueos son
 * explícitos (`SELECT … FOR UPDATE` / `FOR NO KEY UPDATE`) y los toma cada repositorio.
 */
export class TypeormTransactionRunner implements TransactionRunner {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction('READ COMMITTED');
      const result = await work(queryRunner as unknown as Transaction);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

/** El `QueryRunner` detrás de una transacción; solo lo usa la infraestructura. */
export function queryRunnerOf(tx: Transaction): QueryRunner {
  return tx as unknown as QueryRunner;
}

const LOCK_CLAUSE = /\bFOR\s+(NO\s+KEY\s+)?UPDATE\b/i;

/**
 * Consulta que bloquea filas dentro de la transacción. Exige la cláusula de bloqueo explícita para
 * que una lectura sin bloqueo no se cuele donde se necesita serializar (por ejemplo, saldos).
 */
export async function queryForUpdate<T = Record<string, unknown>>(
  tx: Transaction,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!LOCK_CLAUSE.test(sql)) {
    throw new Error('queryForUpdate requiere FOR UPDATE o FOR NO KEY UPDATE');
  }
  return queryRunnerOf(tx).query(sql, params) as Promise<T[]>;
}

/** Consulta sin bloqueo dentro de la transacción. */
export async function queryIn<T = Record<string, unknown>>(
  tx: Transaction,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return queryRunnerOf(tx).query(sql, params) as Promise<T[]>;
}
