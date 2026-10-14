import type { OtpChallenge, Transfer } from '@devchrisvaz/wallet-contract';
import { maskEmail } from '../../../shared/masking.js';
import { Money } from '../../../shared/money.js';
import { effectiveStatus } from '../domain/transfer-status.js';
import type { TransferRow } from './ports.js';

/** Transferencia con lo necesario para mostrarla como comprobante. */
export interface TransferDetails extends TransferRow {
  readonly destinationName: string;
  readonly destinationClabe: string;
  readonly ownerEmail: string;
  /** Desafío del OTP, si existe. */
  readonly code: { readonly attempts: number; readonly resendCount: number } | null;
}

export interface OtpPolicy {
  readonly maxAttempts: number;
  readonly maxResends: number;
}

/** Lectura de una transferencia de usuario con su destino y su desafío. */
export interface TransferDetailsReader {
  find(transferId: string): Promise<TransferDetails | null>;
}

/** Programadas pendientes de un usuario, en orden de ejecución (TRF-33). */
export interface ScheduledTransfersReader {
  listScheduled(userId: string): Promise<TransferDetails[]>;
}

export function otpChallenge(
  details: TransferDetails,
  policy: OtpPolicy,
  deliveryStatus: 'SENT' | 'FAILED' = 'SENT',
): OtpChallenge {
  return {
    channel: 'EMAIL',
    deliveryStatus,
    maskedDestination: maskEmail(details.ownerEmail),
    expiresAt: (details.otpExpiresAt ?? details.createdAt).toISOString(),
    attemptsRemaining: Math.max(policy.maxAttempts - (details.code?.attempts ?? 0), 0),
    resendsRemaining: Math.max(policy.maxResends - (details.code?.resendCount ?? 0), 0),
  };
}

/**
 * Transferencia del contrato (TRF-26): destino con nombre y últimos 4 dígitos de la CLABE, monto con
 * 2 decimales, estado visible (`EXPIRED` calculado) y el desafío solo mientras está pendiente.
 */
export function toTransferView(
  details: TransferDetails,
  now: Date,
  policy: OtpPolicy,
  deliveryStatus?: 'SENT' | 'FAILED',
): Transfer {
  const status = effectiveStatus(details, now);
  const own = details.kind === 'OWN';
  return {
    id: details.id,
    status,
    kind: own ? 'OWN' : 'THIRD_PARTY',
    fromAccountId: details.fromAccountId,
    destination: {
      type: own ? 'OWN_ACCOUNT' : 'BENEFICIARY',
      accountId: own ? details.toAccountId : null,
      beneficiaryId: own ? null : details.beneficiaryId,
      displayName: details.destinationName,
      clabeLast4: details.destinationClabe.slice(-4),
    },
    amount: Money.fromCents(details.amountCents).toDecimalString(),
    concept: details.concept,
    reference: String(details.reference),
    requiresOtp: details.requiresOtp,
    otp: status === 'PENDING_OTP' ? otpChallenge(details, policy, deliveryStatus) : null,
    rejectionReason: details.rejectionReason,
    failureReason: details.failureReason,
    // En toda programada, sin importar su estado; nula en las inmediatas (TRF-34).
    scheduledFor: details.scheduledFor,
    cancelledAt: details.cancelledAt?.toISOString() ?? null,
    createdAt: details.createdAt.toISOString(),
    completedAt: details.completedAt?.toISOString() ?? null,
  };
}
