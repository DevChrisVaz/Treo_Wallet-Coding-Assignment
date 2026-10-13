/** Estados que se guardan. `EXPIRED` no se guarda: se calcula al leer (TRF-19). */
export type StoredTransferStatus = 'PENDING_OTP' | 'COMPLETED' | 'REJECTED' | 'FAILED';
export type TransferStatus = StoredTransferStatus | 'EXPIRED';

export type TransferEvent =
  /** Monto ≤ umbral y validaciones OK al crear. */
  | 'COMPLETE_IMMEDIATELY'
  /** Saldo insuficiente o límite excedido al crear. */
  | 'REJECT'
  /** Monto > umbral y validaciones OK al crear. */
  | 'REQUIRE_OTP'
  /** OTP correcto y revalidación OK. */
  | 'CONFIRM'
  /** Revalidación de saldo o límite fallida al confirmar. */
  | 'FAIL_REVALIDATION'
  /** Tercer OTP incorrecto. */
  | 'EXHAUST_OTP';

export class InvalidTransferTransition extends Error {
  constructor(
    readonly from: StoredTransferStatus | null,
    readonly event: TransferEvent,
  ) {
    super(`Transición inválida: ${from ?? 'nueva'} + ${event}`);
    this.name = 'InvalidTransferTransition';
  }
}

const TRANSITIONS: Record<string, StoredTransferStatus> = {
  'null:COMPLETE_IMMEDIATELY': 'COMPLETED',
  'null:REJECT': 'REJECTED',
  'null:REQUIRE_OTP': 'PENDING_OTP',
  'PENDING_OTP:CONFIRM': 'COMPLETED',
  'PENDING_OTP:FAIL_REVALIDATION': 'FAILED',
  'PENDING_OTP:EXHAUST_OTP': 'FAILED',
};

/**
 * Máquina de estados de la transferencia como función pura: estado actual (o `null` si se está
 * creando) + evento → nuevo estado, o error si la transición no existe. COMPLETED, REJECTED y FAILED
 * son finales.
 */
export function transition(
  from: StoredTransferStatus | null,
  event: TransferEvent,
): StoredTransferStatus {
  const to = TRANSITIONS[`${from ?? 'null'}:${event}`];
  if (!to) throw new InvalidTransferTransition(from, event);
  return to;
}

/** Estado visible: una `PENDING_OTP` cuyo OTP ya venció se informa como `EXPIRED`. */
export function effectiveStatus(
  transfer: { readonly status: StoredTransferStatus; readonly otpExpiresAt: Date | null },
  now: Date,
): TransferStatus {
  if (
    transfer.status === 'PENDING_OTP' &&
    transfer.otpExpiresAt !== null &&
    transfer.otpExpiresAt.getTime() <= now.getTime()
  ) {
    return 'EXPIRED';
  }
  return transfer.status;
}
