import type { DataSource } from 'typeorm';
import type { MovementPageQuery, MovementReader, MovementRecord } from '../application/ports.js';
import { projectMovementsSql, toMovementRecord, type MovementRow } from './movement-projection.js';

/**
 * SQL parametrizado de una página del historial (lo usa `page` y lo explican las pruebas de planes):
 * solo los predicados que aplican, para que el planificador elija el índice adecuado.
 */
export function buildMovementQuery(query: MovementPageQuery): { sql: string; params: unknown[] } {
  const params: unknown[] = [query.accountId];
  const where = ['e.account_id = $1'];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (query.start) where.push(`e.created_at >= ${param(query.start)}`);
  if (query.endExclusive) where.push(`e.created_at < ${param(query.endExclusive)}`);
  if (query.types.length === 1) where.push(`e.type = ${param(query.types[0])}`);
  else if (query.types.length > 1) where.push(`e.type = ANY(${param([...query.types])})`);
  if (query.after) {
    where.push(
      `(e.created_at, e.id) < (${param(query.after.occurredAt)}::timestamptz, ${param(query.after.id)}::bigint)`,
    );
  }
  const limit = param(query.limit);
  const sql = projectMovementsSql(
    `SELECT e.* FROM ledger_entries e
            WHERE ${where.join('\n              AND ')}
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT ${limit}`,
    'DESC',
  );
  return { sql, params };
}

/**
 * Historial con paginación keyset (HIS-01 a HIS-07), en SQL crudo parametrizado:
 * - solo los predicados que aplican, para que el planificador use
 *   `ix_ledger_entries_account_created` o, con un tipo, `ix_ledger_entries_account_type_created`
 *   como recorrido ordenado sin `Sort`;
 * - la comparación de filas `(created_at, id) < ($t, $id)` acota el recorrido desde la página 2;
 * - la proyección a movimiento (contraparte, concepto y referencia, con las uniones `LATERAL` que
 *   conservan el orden del índice) es la de `movement-projection`, la misma del estado de cuenta.
 */
export class PgMovementReader implements MovementReader {
  constructor(private readonly dataSource: DataSource) {}

  async page(query: MovementPageQuery): Promise<MovementRecord[]> {
    const { sql, params } = buildMovementQuery(query);
    const rows: MovementRow[] = await this.dataSource.query(sql, params);
    return rows.map(toMovementRecord);
  }
}
