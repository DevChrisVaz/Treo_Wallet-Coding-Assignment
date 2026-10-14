import type { DataSource } from 'typeorm';
import type { TransferDetails, TransferDetailsReader } from '../application/transfer-view.js';
import { transferFromRow } from './pg-transfer-store.js';

/** Transferencia de usuario con su destino (cuenta o beneficiario), el email del dueño y su OTP. */
export class PgTransferDetails implements TransferDetailsReader {
  constructor(private readonly dataSource: DataSource) {}

  async find(transferId: string): Promise<TransferDetails | null> {
    const rows: (Parameters<typeof transferFromRow>[0] & {
      destination_name: string;
      destination_clabe: string;
      owner_email: string;
      code_attempts: number | null;
      code_resend_count: number | null;
    })[] = await this.dataSource.query(
      `SELECT t.id, t.user_id, t.idempotency_key, t.request_fingerprint, t.kind, t.status,
              t.from_account_id, t.to_account_id, t.beneficiary_id, t.amount_cents, t.concept,
              t.reference, t.requires_otp, t.rejection_reason, t.failure_reason, t.otp_expires_at,
              t.created_at, t.completed_at, t.scheduled_for::text AS scheduled_for, t.cancelled_at,
              COALESCE(b.alias, dest.name) AS destination_name,
              COALESCE(b.clabe, dest.clabe) AS destination_clabe,
              u.email AS owner_email,
              c.attempts AS code_attempts,
              c.resend_count AS code_resend_count
         FROM transfers t
         JOIN users u ON u.id = t.user_id
         JOIN accounts dest ON dest.id = t.to_account_id
         LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
         LEFT JOIN one_time_codes c
           ON c.purpose = 'TRANSFER_CONFIRMATION' AND c.subject_id = t.id
        WHERE t.id = $1`,
      [transferId],
    );
    const [row] = rows;
    if (!row) return null;
    return {
      ...transferFromRow(row),
      destinationName: row.destination_name,
      destinationClabe: row.destination_clabe,
      ownerEmail: row.owner_email,
      code:
        row.code_attempts === null
          ? null
          : { attempts: row.code_attempts, resendCount: row.code_resend_count ?? 0 },
    };
  }
}
