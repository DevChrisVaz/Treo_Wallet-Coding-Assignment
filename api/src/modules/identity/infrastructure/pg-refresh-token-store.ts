import { queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { RefreshTokenRow, RefreshTokenStore } from '../application/sessions.js';

/** Refresh tokens en `refresh_tokens`: solo el hash del token. */
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
}
