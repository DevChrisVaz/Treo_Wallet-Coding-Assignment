/** Estados que se guardan. `EXPIRED` no se guarda: se calcula al leer (TRF-19). */
export type StoredTransferStatus =
  | 'PENDING_OTP'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  /** Programada: espera su fecha sin haber movido dinero (TRF-27, TRF-34). */
  | 'SCHEDULED'
  /** Programada que el usuario canceló: final y sin dinero (TRF-32). */
  | 'CANCELLED';
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
  | 'EXHAUST_OTP'
  /** Programada de hasta el umbral al crearla, o programada con su OTP correcto (TRF-27, TRF-28). */
  | 'SCHEDULE'
  /** Ejecución de una programada con saldo y límite suficientes (TRF-30). */
  | 'EXECUTE_OK'
  /** Ejecución de una programada sin saldo o sin límite (TRF-30). */
  | 'EXECUTE_FAIL'
  /** Cancelación del usuario (TRF-32). */
  | 'CANCEL';

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
  // Programadas (D2 de scheduled-transfers): una SCHEDULED solo se ejecuta o se cancela.
  'null:SCHEDULE': 'SCHEDULED',
  'PENDING_OTP:SCHEDULE': 'SCHEDULED',
  'SCHEDULED:EXECUTE_OK': 'COMPLETED',
  'SCHEDULED:EXECUTE_FAIL': 'FAILED',
  'SCHEDULED:CANCEL': 'CANCELLED',
};

/**
 * Máquina de estados de la transferencia como función pura: estado actual (o `null` si se está
 * creando) + evento → nuevo estado, o error si la transición no existe. COMPLETED, REJECTED, FAILED
 * y CANCELLED son finales.
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
