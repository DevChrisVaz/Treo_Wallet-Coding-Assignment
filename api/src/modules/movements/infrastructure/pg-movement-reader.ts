import type { DataSource } from 'typeorm';
import type { MovementType } from '../../transfers/domain/ledger.js';
import type { MovementPageQuery, MovementReader, MovementRecord } from '../application/ports.js';

interface Row {
  id: string;
  type: MovementType;
  amount_cents: string;
  balance_after_cents: string;
  occurred_at: string;
  transfer_id: string;
  concept: string;
  reference: number;
  counterparty_name: string | null;
  counterparty_clabe_last4: string | null;
}

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
  const sql = `SELECT e.id::text AS id, e.type, e.amount_cents, e.balance_after_cents,
              to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,
              t.id AS transfer_id, t.concept, t.reference,
              cp.name AS counterparty_name, cp.clabe_last4 AS counterparty_clabe_last4
         FROM (
           SELECT e.* FROM ledger_entries e
            WHERE ${where.join('\n              AND ')}
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT ${limit}
         ) e
         CROSS JOIN LATERAL (
           SELECT t.id, t.concept, t.reference, t.beneficiary_id
             FROM transfers t WHERE t.id = e.transfer_id
         ) t
         LEFT JOIN LATERAL (
           SELECT CASE e.type
                    WHEN 'TRANSFER_OUT' THEN b.alias
                    WHEN 'TRANSFER_IN' THEN sender.full_name
                    ELSE other.name
                  END AS name,
                  right(other.clabe, 4) AS clabe_last4
             FROM ledger_entries o
             JOIN accounts other ON other.id = o.account_id
             LEFT JOIN users sender ON sender.id = other.user_id
             LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
            WHERE e.type <> 'DEPOSIT'
              AND o.transfer_id = e.transfer_id AND o.account_id <> e.account_id
         ) cp ON true
        ORDER BY e.created_at DESC, e.id DESC`;
  return { sql, params };
}

/**
 * Historial con paginación keyset (HIS-01 a HIS-07), en SQL crudo parametrizado:
 * - solo los predicados que aplican, para que el planificador use
 *   `ix_ledger_entries_account_created` o, con un tipo, `ix_ledger_entries_account_type_created`
 *   como recorrido ordenado sin `Sort`;
 * - la comparación de filas `(created_at, id) < ($t, $id)` acota el recorrido desde la página 2;
 * - el `LIMIT` se aplica antes de unir nada y las uniones son `LATERAL`: los `Nested Loop`
 *   conservan el orden del índice y el `ORDER BY` externo no agrega un `Sort` (HIS-09; con joins
 *   normales el planificador elegía un hash join y reordenaba);
 * - la contraparte sale del asiento opuesto de la misma transferencia: nula en DEPOSIT, alias del
 *   beneficiario en TRANSFER_OUT, nombre del remitente en TRANSFER_IN y nombre de la cuenta en los
 *   traspasos propios, siempre con solo los últimos 4 dígitos de la CLABE.
 */
export class PgMovementReader implements MovementReader {
  constructor(private readonly dataSource: DataSource) {}

  async page(query: MovementPageQuery): Promise<MovementRecord[]> {
    const { sql, params } = buildMovementQuery(query);
    const rows: Row[] = await this.dataSource.query(sql, params);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      amountCents: BigInt(row.amount_cents),
      balanceAfterCents: BigInt(row.balance_after_cents),
      occurredAt: row.occurred_at,
      transferId: row.transfer_id,
      concept: row.concept,
      reference: row.reference,
      counterparty:
        row.counterparty_name === null
          ? null
          : { name: row.counterparty_name, clabeLast4: row.counterparty_clabe_last4 },
    }));
  }
}
