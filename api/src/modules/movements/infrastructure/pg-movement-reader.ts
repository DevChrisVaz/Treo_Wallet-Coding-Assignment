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
 * Historial con paginación keyset (HIS-01 a HIS-07), en SQL crudo parametrizado:
 * - solo los predicados que aplican, para que el planificador use
 *   `ix_ledger_entries_account_created` o, con un tipo, `ix_ledger_entries_account_type_created`
 *   como recorrido ordenado sin `Sort`;
 * - la comparación de filas `(created_at, id) < ($t, $id)` acota el recorrido desde la página 2;
 * - la contraparte sale del asiento opuesto de la misma transferencia: nula en DEPOSIT, alias del
 *   beneficiario en TRANSFER_OUT, nombre del remitente en TRANSFER_IN y nombre de la cuenta en los
 *   traspasos propios, siempre con solo los últimos 4 dígitos de la CLABE.
 */
export class PgMovementReader implements MovementReader {
  constructor(private readonly dataSource: DataSource) {}

  async page(query: MovementPageQuery): Promise<MovementRecord[]> {
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
    const rows: Row[] = await this.dataSource.query(
      `SELECT e.id::text AS id, e.type, e.amount_cents, e.balance_after_cents,
              to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,
              t.id AS transfer_id, t.concept, t.reference,
              CASE e.type
                WHEN 'DEPOSIT' THEN NULL
                WHEN 'TRANSFER_OUT' THEN b.alias
                WHEN 'TRANSFER_IN' THEN sender.full_name
                ELSE other.name
              END AS counterparty_name,
              CASE e.type
                WHEN 'DEPOSIT' THEN NULL
                ELSE right(other.clabe, 4)
              END AS counterparty_clabe_last4
         FROM (
           SELECT e.* FROM ledger_entries e
            WHERE ${where.join('\n              AND ')}
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT ${limit}
         ) e
         JOIN transfers t ON t.id = e.transfer_id
         JOIN ledger_entries o ON o.transfer_id = e.transfer_id AND o.account_id <> e.account_id
         JOIN accounts other ON other.id = o.account_id
         LEFT JOIN users sender ON sender.id = other.user_id
         LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
        ORDER BY e.created_at DESC, e.id DESC`,
      params,
    );
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
