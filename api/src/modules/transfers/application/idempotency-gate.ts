import { DomainError } from '../../../shared/errors.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { TransferRow, TransferStore } from './ports.js';

export type ClaimResult =
  { readonly kind: 'NEW' } | { readonly kind: 'REPLAY'; readonly existing: TransferRow };

/**
 * Reclamo de la llave de idempotencia (TRF-03, TRF-04, TRF-05): la transferencia es el registro
 * de idempotencia. `INSERT … ON CONFLICT DO NOTHING` sobre `uq_transfers_user_idempotency_key`:
 * si otra transacción con la misma llave está en curso, PostgreSQL espera a que termine; después se
 * relee la existente. Misma huella → reintento; otra huella → `IDEMPOTENCY_KEY_REUSED`.
 */
export class IdempotencyGate {
  constructor(private readonly store: TransferStore) {}

  async claim(tx: Transaction, row: TransferRow): Promise<ClaimResult> {
    if (await this.store.claim(tx, row)) return { kind: 'NEW' };
    const existing = await this.store.findByKey(tx, row.userId ?? '', row.idempotencyKey ?? '');
    if (!existing) throw new Error('Conflicto de idempotencia sin transferencia existente');
    if (existing.fingerprint !== row.fingerprint) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REUSED',
        'La llave de idempotencia ya se usó con otros datos; genera una nueva para otra transferencia',
      );
    }
    return { kind: 'REPLAY', existing };
  }
}
