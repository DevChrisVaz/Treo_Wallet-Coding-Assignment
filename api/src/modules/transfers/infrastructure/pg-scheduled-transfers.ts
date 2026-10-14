import type { DataSource } from 'typeorm';
import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type {
  DueTransfer,
  ScheduledCap,
  ScheduledQueue,
  TransferRow,
} from '../application/ports.js';
import { TRANSFER_SELECT, transferFromRow } from './pg-transfer-store.js';

/** Consultas propias de las transferencias programadas en PostgreSQL. */
export class PgScheduledTransfers implements ScheduledCap, ScheduledQueue {
  constructor(private readonly dataSource: DataSource) {}

  async lockOwner(tx: Transaction, userId: string): Promise<void> {
    const rows = await queryForUpdate(tx, `SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE`, [
      userId,
    ]);
    if (rows.length !== 1) throw new Error('El dueño de la programada no existe');
  }

  /** Usa `ix_transfers_user_scheduled` para las SCHEDULED; las pendientes son pocas por usuario. */
  async countActive(
    tx: Transaction,
    userId: string,
    now: Date,
    exceptTransferId: string,
  ): Promise<number> {
    const [row] = await queryIn<{ active: number }>(
      tx,
      `SELECT count(*)::int AS active FROM transfers
        WHERE user_id = $1 AND id <> $3
          AND (status = 'SCHEDULED'
               OR (status = 'PENDING_OTP' AND scheduled_for IS NOT NULL AND otp_expires_at > $2))`,
      [userId, now, exceptTransferId],
    );
    return row?.active ?? 0;
  }

  /**
   * Recorre `ix_transfers_scheduled_due` en su orden. El siguiente lote empieza después de la última
   * candidata del anterior (comparación de filas con la clave que PostgreSQL lee de esa misma fila,
   * sin pasar `created_at` por JavaScript): una candidata que no se pudo ejecutar no se vuelve a
   * leer en la misma pasada.
   */
  async due(day: string, limit: number, after: string | null): Promise<DueTransfer[]> {
    const rows: { id: string; user_id: string; kind: DueTransfer['kind'] }[] =
      await this.dataSource.query(
        `SELECT t.id, t.user_id, t.kind FROM transfers t
          WHERE t.status = 'SCHEDULED' AND t.scheduled_for <= $1::date
            AND ($3::uuid IS NULL
                 OR (t.scheduled_for, t.created_at, t.id)
                    > (SELECT p.scheduled_for, p.created_at, p.id FROM transfers p WHERE p.id = $3))
          ORDER BY t.scheduled_for, t.created_at, t.id
          LIMIT $2`,
        [day, limit, after],
      );
    return rows.map((row) => ({ id: row.id, userId: row.user_id, kind: row.kind }));
  }

  /**
   * `SKIP LOCKED`: si otra instancia o una cancelación tiene la fila, no espera. El filtro de estado
   * se vuelve a evaluar sobre la versión vigente de la fila (`READ COMMITTED`), así que una ya
   * ejecutada o cancelada desde que se leyó la candidata no devuelve nada.
   */
  async lockDue(tx: Transaction, transferId: string): Promise<TransferRow | null> {
    const [row] = await queryForUpdate<Parameters<typeof transferFromRow>[0]>(
      tx,
      `SELECT ${TRANSFER_SELECT} FROM transfers
        WHERE id = $1 AND status = 'SCHEDULED'
        FOR NO KEY UPDATE SKIP LOCKED`,
      [transferId],
    );
    return row ? transferFromRow(row) : null;
  }
}
