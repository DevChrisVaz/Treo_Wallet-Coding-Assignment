import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { FailureReason, RejectionReason } from '../application/ports.js';
import type { TransferKind } from '../domain/ledger.js';
import type { StoredTransferStatus } from '../domain/transfer-status.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { TransferRow, TransferStore } from '../application/ports.js';

export const TRANSFER_COLUMNS = `id, user_id, idempotency_key, request_fingerprint, kind, status,
  from_account_id, to_account_id, beneficiary_id, amount_cents, concept, reference, requires_otp,
  rejection_reason, failure_reason, otp_expires_at, created_at, completed_at, scheduled_for,
  cancelled_at`;

/**
 * Las mismas columnas para leer. `scheduled_for` sale como texto: el driver convierte un `date` en
 * un `Date` a la medianoche local del proceso, que en otra zona horaria cambiaría el día.
 */
export const TRANSFER_SELECT = `id, user_id, idempotency_key, request_fingerprint, kind, status,
  from_account_id, to_account_id, beneficiary_id, amount_cents, concept, reference, requires_otp,
  rejection_reason, failure_reason, otp_expires_at, created_at, completed_at,
  scheduled_for::text AS scheduled_for, cancelled_at`;

export function transferValues(row: TransferRow): unknown[] {
  return [
    row.id,
    row.userId,
    row.idempotencyKey,
    row.fingerprint,
    row.kind,
    row.status,
    row.fromAccountId,
    row.toAccountId,
    row.beneficiaryId,
    row.amountCents.toString(),
    row.concept,
    row.reference,
    row.requiresOtp,
    row.rejectionReason,
    row.failureReason,
    row.otpExpiresAt,
    row.createdAt,
    row.completedAt,
    row.scheduledFor,
    row.cancelledAt,
  ];
}

export const TRANSFER_PLACEHOLDERS = Array.from({ length: 20 }, (_, i) => `$${i + 1}`).join(', ');

interface Row {
  id: string;
  user_id: string | null;
  idempotency_key: string | null;
  request_fingerprint: string | null;
  kind: TransferKind;
  status: StoredTransferStatus;
  from_account_id: string;
  to_account_id: string;
  beneficiary_id: string | null;
  amount_cents: string;
  concept: string;
  reference: number;
  requires_otp: boolean;
  rejection_reason: RejectionReason | null;
  failure_reason: FailureReason | null;
  otp_expires_at: Date | null;
  created_at: Date;
  completed_at: Date | null;
  scheduled_for: string | null;
  cancelled_at: Date | null;
}

export function transferFromRow(row: Row): TransferRow {
  return {
    id: row.id,
    userId: row.user_id,
    idempotencyKey: row.idempotency_key,
    fingerprint: row.request_fingerprint,
    kind: row.kind,
    status: row.status,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    beneficiaryId: row.beneficiary_id,
    amountCents: BigInt(row.amount_cents),
    concept: row.concept,
    reference: row.reference,
    requiresOtp: row.requires_otp,
    rejectionReason: row.rejection_reason,
    failureReason: row.failure_reason,
    otpExpiresAt: row.otp_expires_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    scheduledFor: row.scheduled_for,
    cancelledAt: row.cancelled_at,
  };
}

/** Transferencias en PostgreSQL. */
export class PgTransferStore implements TransferStore {
  async insert(tx: Transaction, row: TransferRow): Promise<void> {
    await queryIn(
      tx,
      `INSERT INTO transfers (${TRANSFER_COLUMNS}) VALUES (${TRANSFER_PLACEHOLDERS})`,
      transferValues(row),
    );
  }

  async claim(tx: Transaction, row: TransferRow): Promise<boolean> {
    const inserted = await queryIn<{ id: string }>(
      tx,
      `INSERT INTO transfers (${TRANSFER_COLUMNS}) VALUES (${TRANSFER_PLACEHOLDERS})
       ON CONFLICT ON CONSTRAINT uq_transfers_user_idempotency_key DO NOTHING
       RETURNING id`,
      transferValues(row),
    );
    return inserted.length === 1;
  }

  async findByKey(
    tx: Transaction,
    userId: string,
    idempotencyKey: string,
  ): Promise<TransferRow | null> {
    const [row] = await queryIn<Row>(
      tx,
      `SELECT ${TRANSFER_SELECT} FROM transfers WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey],
    );
    return row ? transferFromRow(row) : null;
  }

  async reject(tx: Transaction, transferId: string, reason: RejectionReason): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'REJECTED', rejection_reason = $2, otp_expires_at = NULL
        WHERE id = $1`,
      [transferId, reason],
    );
  }

  async awaitOtp(tx: Transaction, transferId: string, otpExpiresAt: Date): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'PENDING_OTP', otp_expires_at = $2 WHERE id = $1`,
      [transferId, otpExpiresAt],
    );
  }

  async schedule(tx: Transaction, transferId: string): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'SCHEDULED', otp_expires_at = NULL WHERE id = $1`,
      [transferId],
    );
  }

  async cancel(tx: Transaction, transferId: string, at: Date): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'CANCELLED', cancelled_at = $2 WHERE id = $1`,
      [transferId, at],
    );
  }

  async lockOwned(
    tx: Transaction,
    transferId: string,
    userId: string,
  ): Promise<TransferRow | null> {
    const [row] = await queryForUpdate<Row>(
      tx,
      `SELECT ${TRANSFER_SELECT} FROM transfers WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [transferId, userId],
    );
    return row ? transferFromRow(row) : null;
  }

  async lockOwnedForStatus(
    tx: Transaction,
    transferId: string,
    userId: string,
  ): Promise<TransferRow | null> {
    const [row] = await queryForUpdate<Row>(
      tx,
      `SELECT ${TRANSFER_SELECT} FROM transfers WHERE id = $1 AND user_id = $2 FOR NO KEY UPDATE`,
      [transferId, userId],
    );
    return row ? transferFromRow(row) : null;
  }

  async fail(tx: Transaction, transferId: string, reason: FailureReason): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'FAILED', failure_reason = $2, otp_expires_at = NULL
        WHERE id = $1`,
      [transferId, reason],
    );
  }
}
