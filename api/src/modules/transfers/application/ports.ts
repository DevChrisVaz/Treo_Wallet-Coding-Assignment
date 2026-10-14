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
  /** Fecha de ejecución (`YYYY-MM-DD`, día de CDMX) de una programada; nula en las inmediatas. */
  readonly scheduledFor: string | null;
  /** Momento de la cancelación; solo en `CANCELLED`. */
  readonly cancelledAt: Date | null;
}

/** Persistencia de transferencias. */
export interface TransferStore {
  insert(tx: Transaction, row: TransferRow): Promise<void>;
  /** Inserta si la llave del usuario está libre; `false` si ya existe (espera a otra en curso). */
  claim(tx: Transaction, row: TransferRow): Promise<boolean>;
  findByKey(tx: Transaction, userId: string, idempotencyKey: string): Promise<TransferRow | null>;
  /** Marca la transferencia como REJECTED con su motivo (sin asientos). */
  reject(tx: Transaction, transferId: string, reason: RejectionReason): Promise<void>;
  /** Deja la transferencia en PENDING_OTP con la vigencia de su código (sin asientos). */
  awaitOtp(tx: Transaction, transferId: string, otpExpiresAt: Date): Promise<void>;
  /** Deja una programada en SCHEDULED, esperando su fecha (sin asientos, TRF-27, TRF-28). */
  schedule(tx: Transaction, transferId: string): Promise<void>;
  /** Bloquea (`FOR UPDATE`) la transferencia si es del usuario; `null` si no existe o es ajena. */
  lockOwned(tx: Transaction, transferId: string, userId: string): Promise<TransferRow | null>;
  /**
   * Bloquea con `FOR NO KEY UPDATE` la transferencia del usuario para cambiar su estado sin mover
   * dinero (confirmar o cancelar una programada, D5 y D7); `null` si no existe o es ajena. Choca con
   * el bloqueo del ejecutor, así que espera si el ejecutor la tiene.
   */
  lockOwnedForStatus(
    tx: Transaction,
    transferId: string,
    userId: string,
  ): Promise<TransferRow | null>;
  /** Marca una transferencia pendiente como FAILED con su motivo (sin asientos). */
  fail(tx: Transaction, transferId: string, reason: FailureReason): Promise<void>;
}

/**
 * Tope de programadas activas por usuario (TRF-29, D8). Las programaciones de un mismo usuario se
 * serializan con la fila de `users`: la segunda cuenta a la primera ya confirmada.
 */
export interface ScheduledCap {
  /**
   * Bloquea la fila del usuario con `FOR NO KEY UPDATE`, que no choca con el `FOR KEY SHARE` que
   * toman las llaves foráneas de `transfers.user_id`. Solo lo toma la programación.
   */
  lockOwner(tx: Transaction, userId: string): Promise<void>;
  /**
   * Programadas activas del usuario a `now`: las SCHEDULED y las programadas en PENDING_OTP con su
   * código vigente, sin contar `exceptTransferId` (la recién reclamada).
   */
  countActive(
    tx: Transaction,
    userId: string,
    now: Date,
    exceptTransferId: string,
  ): Promise<number>;
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
