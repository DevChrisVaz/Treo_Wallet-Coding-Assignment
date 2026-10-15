import type { DataSource, QueryRunner } from 'typeorm';
import type { MovementRecord } from '../../movements/application/ports.js';
import {
  projectMovementsSql,
  toMovementRecord,
  type MovementRow,
} from '../../movements/infrastructure/movement-projection.js';
import type { StatementAccount, StatementReader, StatementSnapshot } from '../application/ports.js';

/** Renglones por tanda (D4). */
const DEFAULT_BATCH_SIZE = 1_000;

const ACCOUNT = `
  SELECT a.id, a.name, a.clabe, u.full_name AS holder_name, a.created_at
    FROM accounts a
    JOIN users u ON u.id = a.user_id
   WHERE a.id = $1 AND a.user_id = $2 AND a.type = 'USER'`;

/** Usa `ix_ledger_entries_account_created`: una lectura por índice, sin sumar la historia. */
const OPENING_BALANCE = `
  SELECT balance_after_cents FROM ledger_entries
   WHERE account_id = $1 AND created_at < $2
   ORDER BY created_at DESC, id DESC
   LIMIT 1`;

/**
 * Tanda ascendente por keyset: el mismo índice `(account_id, created_at DESC, id DESC)` recorrido
 * hacia atrás, sin `Sort`. Desde la segunda tanda, `(created_at, id) > ($t, $id)` arranca justo
 * después del último renglón entregado, aunque compartan el instante.
 */
function batchSql(first: boolean): string {
  const after = first ? '' : `AND (e.created_at, e.id) > ($5::timestamptz, $6::bigint)`;
  return projectMovementsSql(
    `SELECT e.* FROM ledger_entries e
            WHERE e.account_id = $1 AND e.created_at >= $2 AND e.created_at < $3 ${after}
            ORDER BY e.created_at, e.id
            LIMIT $4`,
    'ASC',
  );
}

class PgStatementSnapshot implements StatementSnapshot {
  constructor(
    private readonly runner: QueryRunner,
    private readonly batchSize: number,
  ) {}

  async account(userId: string, accountId: string): Promise<StatementAccount | null> {
    const [row]: {
      id: string;
      name: string;
      clabe: string;
      holder_name: string;
      created_at: Date;
    }[] = await this.runner.query(ACCOUNT, [accountId, userId]);
    return row
      ? {
          id: row.id,
          name: row.name,
          clabe: row.clabe,
          holderName: row.holder_name,
          createdAt: row.created_at,
        }
      : null;
  }

  async openingBalance(accountId: string, start: Date): Promise<bigint> {
    const [row]: { balance_after_cents: string }[] = await this.runner.query(OPENING_BALANCE, [
      accountId,
      start,
    ]);
    return row ? BigInt(row.balance_after_cents) : 0n;
  }

  async *movements(
    accountId: string,
    start: Date,
    endExclusive: Date,
  ): AsyncIterable<readonly MovementRecord[]> {
    let last: MovementRecord | undefined;
    for (;;) {
      const params: unknown[] = [accountId, start, endExclusive, this.batchSize];
      if (last) params.push(last.occurredAt, last.id);
      const rows: MovementRow[] = await this.runner.query(batchSql(!last), params);
      if (rows.length === 0) return;
      const batch = rows.map(toMovementRecord);
      yield batch;
      if (rows.length < this.batchSize) return;
      last = batch.at(-1);
    }
  }
}

/**
 * Lector del estado de cuenta (D3, D4). Cada `withSnapshot` toma una conexión y abre
 * `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`: la primera sentencia fija la instantánea y
 * todas las siguientes (cuenta y titular, saldo inicial y tandas) ven el mismo estado. Al terminar
 * hace `COMMIT`, o `ROLLBACK` si el trabajo falla, antes de devolver la conexión al pool, para que
 * nunca regrese con una transacción abierta.
 */
export class PgStatementReader implements StatementReader {
  private readonly batchSize: number;

  constructor(
    private readonly dataSource: DataSource,
    options: { readonly batchSize?: number } = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  async withSnapshot<T>(work: (snapshot: StatementSnapshot) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      let result: T;
      try {
        result = await work(new PgStatementSnapshot(runner, this.batchSize));
      } catch (error) {
        await runner.query('ROLLBACK');
        throw error;
      }
      await runner.query('COMMIT');
      return result;
    } finally {
      await runner.release();
    }
  }
}
