import { DomainError } from '../../../shared/errors.js';
import { Money } from '../../../shared/money.js';
import type { TransferStatus } from '../domain/transfer-status.js';
import type { RejectionReason } from './ports.js';

/**
 * Error de negocio por saldo o límite (TRF-10, TRF-11, TRF-16), igual al crear (REJECTED) que al
 * confirmar (FAILED): lleva el `transferId` y, en el límite, lo que queda del día.
 */
export function balanceOrLimitError(
  reason: RejectionReason,
  transferId: string,
  remaining: Money | null,
): DomainError {
  return reason === 'INSUFFICIENT_FUNDS'
    ? new DomainError(
        'INSUFFICIENT_FUNDS',
        'El saldo de la cuenta no alcanza para esta transferencia',
        { transferId },
      )
    : new DomainError('DAILY_LIMIT_EXCEEDED', 'La transferencia excede tu límite diario', {
        transferId,
        remaining: (remaining ?? Money.ZERO).toDecimalString(),
      });
}

export function transferNotPending(status: TransferStatus): DomainError {
  return new DomainError('TRANSFER_NOT_PENDING', 'La transferencia ya no está pendiente', {
    transferStatus: status,
  });
}

/** Solo una SCHEDULED se cancela (TRF-32); el problema dice en qué estado está. */
export function transferNotCancellable(status: TransferStatus): DomainError {
  return new DomainError(
    'TRANSFER_NOT_CANCELLABLE',
    'Solo se puede cancelar una transferencia programada que no se ha ejecutado',
    { transferStatus: status },
  );
}

export function transferExpired(): DomainError {
  return new DomainError('TRANSFER_EXPIRED', 'El código de la transferencia venció');
}
