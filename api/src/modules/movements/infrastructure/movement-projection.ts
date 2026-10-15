import type { MovementType } from '../../transfers/domain/ledger.js';
import type { MovementRecord } from '../application/ports.js';

/** Fila que devuelve `projectMovementsSql`. */
export interface MovementRow {
  id: string;
  type: MovementType;
  amount_cents: string;
  balance_after_cents: string;
  occurred_at: string;
  transfer_id: string;
  concept: string;
  reference: number | null;
  counterparty_name: string | null;
  counterparty_clabe_last4: string | null;
}

/**
 * Proyección de asiento a movimiento (HIS-03), compartida por el historial y el estado de cuenta
 * para que no diverjan (D4 de account-statements). Recibe la subconsulta que elige los asientos
 * (`SELECT e.* FROM ledger_entries e WHERE … ORDER BY … LIMIT …`) y la envuelve:
 * - el `LIMIT` de la subconsulta se aplica antes de unir nada y las uniones son `LATERAL`, así que
 *   los `Nested Loop` conservan el orden del índice y el `ORDER BY` externo no agrega un `Sort`
 *   (HIS-09; con joins normales el planificador elegía un hash join y reordenaba);
 * - la contraparte sale del asiento opuesto de la misma transferencia: nula en DEPOSIT, alias del
 *   beneficiario en TRANSFER_OUT, nombre del remitente en TRANSFER_IN y nombre de la cuenta en los
 *   traspasos propios, siempre con solo los últimos 4 dígitos de la CLABE;
 * - el momento sale con microsegundos (la precisión de `timestamptz`), que es lo que necesita una
 *   posición keyset exacta.
 */
export function projectMovementsSql(entries: string, direction: 'ASC' | 'DESC'): string {
  return `SELECT e.id::text AS id, e.type, e.amount_cents, e.balance_after_cents,
              to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,
              t.id AS transfer_id, t.concept, t.reference,
              cp.name AS counterparty_name, cp.clabe_last4 AS counterparty_clabe_last4
         FROM (
           ${entries}
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
        ORDER BY e.created_at ${direction}, e.id ${direction}`;
}

/** Fila de `projectMovementsSql` a movimiento, con los montos como `bigint`. */
export function toMovementRecord(row: MovementRow): MovementRecord {
  return {
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
  };
}
