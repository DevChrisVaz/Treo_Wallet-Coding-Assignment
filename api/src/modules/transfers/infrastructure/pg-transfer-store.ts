import { queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { TransferRow, TransferStore } from '../application/ports.js';

export const TRANSFER_COLUMNS = `id, user_id, idempotency_key, request_fingerprint, kind, status,
  from_account_id, to_account_id, beneficiary_id, amount_cents, concept, reference, requires_otp,
  rejection_reason, failure_reason, otp_expires_at, created_at, completed_at`;

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
  ];
}

export const TRANSFER_PLACEHOLDERS = Array.from({ length: 18 }, (_, i) => `$${i + 1}`).join(', ');

/** Transferencias en PostgreSQL. */
export class PgTransferStore implements TransferStore {
  async insert(tx: Transaction, row: TransferRow): Promise<void> {
    await queryIn(
      tx,
      `INSERT INTO transfers (${TRANSFER_COLUMNS}) VALUES (${TRANSFER_PLACEHOLDERS})`,
      transferValues(row),
    );
  }
}
