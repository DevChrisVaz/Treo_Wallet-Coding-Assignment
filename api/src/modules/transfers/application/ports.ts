import type { Transaction } from '../../../shared/transaction.js';
import type { LockedAccount, TransferKind } from '../domain/ledger.js';
import type { StoredTransferStatus } from '../domain/transfer-status.js';

export type RejectionReason = 'INSUFFICIENT_FUNDS' | 'DAILY_LIMIT_EXCEEDED';
export type FailureReason = RejectionReason | 'OTP_ATTEMPTS_EXHAUSTED';

export interface TransferRow {
  readonly id: string;
  readonly userId: string | null;
  readonly idempotencyKey: string | null;
  readonly fingerprint: string | null;
  readonly kind: TransferKind;
  readonly status: StoredTransferStatus;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly beneficiaryId: string | null;
  readonly amountCents: bigint;
  readonly concept: string;
  readonly reference: number;
  readonly requiresOtp: boolean;
  readonly rejectionReason: RejectionReason | null;
  readonly failureReason: FailureReason | null;
  readonly otpExpiresAt: Date | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

/** Persistencia de transferencias. */
export interface TransferStore {
  insert(tx: Transaction, row: TransferRow): Promise<void>;
  /** Inserta si la llave del usuario está libre; `false` si ya existe (espera a otra en curso). */
  claim(tx: Transaction, row: TransferRow): Promise<boolean>;
  findByKey(tx: Transaction, userId: string, idempotencyKey: string): Promise<TransferRow | null>;
  /** Marca la transferencia como REJECTED con su motivo (sin asientos). */
  reject(tx: Transaction, transferId: string, reason: RejectionReason): Promise<void>;
}

/** Bloqueo y resolución de cuentas para mover dinero. */
export interface AccountLocks {
  /** Id de la cuenta SYSTEM (Tesorería). */
  treasuryId(tx: Transaction): Promise<string>;
  /** Cuenta USER por id o por CLABE, sin importar su dueño (solo para el fondeo). */
  findUserAccount(idOrClabe: string): Promise<string | null>;
  /**
   * Bloquea las cuentas con `SELECT … ORDER BY id FOR NO KEY UPDATE` (orden global, sin deadlocks)
   * y devuelve las que existen. Con `ownedBy`, la propiedad se verifica en la misma sentencia.
   */
  lock(
    tx: Transaction,
    ids: readonly string[],
    options?: { readonly ownedBy?: string; readonly ownedIds?: readonly string[] },
  ): Promise<LockedAccount[]>;
}
