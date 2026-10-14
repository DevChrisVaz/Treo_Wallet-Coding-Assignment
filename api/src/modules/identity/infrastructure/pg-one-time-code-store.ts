import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { CodePurpose, OneTimeCodeStore, StoredCode } from '../application/one-time-codes.js';

interface Row {
  id: string;
  code_hash: string;
  attempts: number;
  resend_count: number;
  expires_at: Date;
  consumed_at: Date | null;
}

/** Desafíos en `one_time_codes`; la fila se bloquea con `FOR UPDATE` en cada operación. */
export class PgOneTimeCodeStore implements OneTimeCodeStore {
  async findForUpdate(
    tx: Transaction,
    purpose: CodePurpose,
    subjectId: string,
  ): Promise<StoredCode | null> {
    const [row] = await queryForUpdate<Row>(
      tx,
      `SELECT id, code_hash, attempts, resend_count, expires_at, consumed_at
         FROM one_time_codes WHERE purpose = $1 AND subject_id = $2 FOR UPDATE`,
      [purpose, subjectId],
    );
    if (!row) return null;
    return {
      id: row.id,
      codeHash: row.code_hash,
      attempts: row.attempts,
      resendCount: row.resend_count,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    };
  }

  async insert(
    tx: Transaction,
    row: { id: string; purpose: CodePurpose; subjectId: string; codeHash: string; expiresAt: Date },
  ): Promise<void> {
    await queryIn(
      tx,
      `INSERT INTO one_time_codes (id, purpose, subject_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, row.purpose, row.subjectId, row.codeHash, row.expiresAt],
    );
  }

  async replace(
    tx: Transaction,
    id: string,
    values: { codeHash: string; expiresAt: Date; resendCount: number },
  ): Promise<void> {
    await queryIn(
      tx,
      `UPDATE one_time_codes
          SET code_hash = $2, expires_at = $3, resend_count = $4, attempts = 0, consumed_at = NULL
        WHERE id = $1`,
      [id, values.codeHash, values.expiresAt, values.resendCount],
    );
  }

  async recordFailedAttempt(tx: Transaction, id: string): Promise<number> {
    const [row] = await queryIn<{ attempts: number }>(
      tx,
      `UPDATE one_time_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
      [id],
    );
    return row?.attempts ?? 0;
  }

  async consume(tx: Transaction, id: string, at: Date): Promise<void> {
    await queryIn(tx, `UPDATE one_time_codes SET consumed_at = $2 WHERE id = $1`, [id, at]);
  }
}
