import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { ScheduledCap } from '../application/ports.js';

/** Consultas propias de las transferencias programadas en PostgreSQL. */
export class PgScheduledTransfers implements ScheduledCap {
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
}
