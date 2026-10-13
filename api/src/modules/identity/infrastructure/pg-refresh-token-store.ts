import { executeIn, queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type {
  RefreshTokenRow,
  RefreshTokenStore,
  RevocationReason,
  StoredRefreshToken,
} from '../application/sessions.js';

interface Row {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  issued_at: Date;
  expires_at: Date;
  family_expires_at: Date;
  used_at: Date | null;
  replaced_by: string | null;
  revoked_at: Date | null;
}

const COLUMNS = `id, user_id, family_id, token_hash, issued_at, expires_at, family_expires_at,
                 used_at, replaced_by, revoked_at`;

function fromRow(row: Row): StoredRefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    familyExpiresAt: row.family_expires_at,
    usedAt: row.used_at,
    replacedBy: row.replaced_by,
    revokedAt: row.revoked_at,
  };
}

/** Refresh tokens en `refresh_tokens`: solo el hash del token; nunca se borran filas. */
export class PgRefreshTokenStore implements RefreshTokenStore {
  async insert(tx: Transaction, row: RefreshTokenRow): Promise<void> {
    await queryIn(
      tx,
      `INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, issued_at, expires_at,
                                   family_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        row.id,
        row.userId,
        row.familyId,
        row.tokenHash,
        row.issuedAt,
        row.expiresAt,
        row.familyExpiresAt,
      ],
    );
  }

  async findByHashForUpdate(
    tx: Transaction,
    tokenHash: string,
  ): Promise<StoredRefreshToken | null> {
    const [row] = await queryForUpdate<Row>(
      tx,
      `SELECT ${COLUMNS} FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return row ? fromRow(row) : null;
  }

  async findByIdForUpdate(tx: Transaction, id: string): Promise<StoredRefreshToken | null> {
    const [row] = await queryForUpdate<Row>(
      tx,
      `SELECT ${COLUMNS} FROM refresh_tokens WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return row ? fromRow(row) : null;
  }

  async markUsed(tx: Transaction, id: string, usedAt: Date, successorId: string): Promise<void> {
    await queryIn(
      tx,
      `UPDATE refresh_tokens SET used_at = COALESCE(used_at, $2), replaced_by = $3 WHERE id = $1`,
      [id, usedAt, successorId],
    );
  }

  async revoke(tx: Transaction, id: string, reason: RevocationReason, at: Date): Promise<void> {
    await queryIn(
      tx,
      `UPDATE refresh_tokens SET revoked_at = $2, revoked_reason = $3
        WHERE id = $1 AND revoked_at IS NULL`,
      [id, at, reason],
    );
  }

  async revokeFamily(
    tx: Transaction,
    familyId: string,
    reason: RevocationReason,
    at: Date,
  ): Promise<number> {
    return executeIn(
      tx,
      `UPDATE refresh_tokens SET revoked_at = $2, revoked_reason = $3
        WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId, at, reason],
    );
  }
}
