import type { OtpChallenge } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { CodePolicy, OneTimeCodeService } from '../../identity/application/one-time-codes.js';
import { effectiveStatus } from '../domain/transfer-status.js';
import { notFound } from './destination-resolver.js';
import type { TransferStore } from './ports.js';
import type { TransferOtpMailer } from './transfer-emails.js';
import { transferExpired, transferNotPending } from './transfer-errors.js';
import { otpChallenge, type TransferDetailsReader } from './transfer-view.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResendTransferOtpDeps {
  readonly transactions: TransactionRunner;
  readonly store: TransferStore;
  readonly codes: OneTimeCodeService;
  readonly otpPolicy: CodePolicy;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly details: TransferDetailsReader;
  readonly otpMail: TransferOtpMailer;
}

/**
 * `POST /transfers/{transferId}/otp/resend` (TRF-20, TRF-25). Bloquea la transferencia (y después su
 * código), exige que esté PENDING_OTP y vigente, y emite un código nuevo: el anterior deja de
 * servir, los intentos vuelven a 3 y la vigencia (`otp_expires_at`) se mueve. Audita
 * `TRANSFER_OTP_RESENT` en la misma transacción y envía el correo después del COMMIT.
 */
export class ResendTransferOtp {
  constructor(private readonly deps: ResendTransferOtpDeps) {}

  async execute(userId: string, transferId: string): Promise<OtpChallenge> {
    if (!UUID.test(transferId)) throw notFound();
    const id = transferId.toLowerCase();
    const { transactions, store, codes, otpPolicy, audit, clock } = this.deps;
    const code = await transactions.run(async (tx) => {
      const transfer = await store.lockOwned(tx, id, userId);
      if (!transfer) throw notFound();
      const status = effectiveStatus(transfer, clock.now());
      if (status === 'EXPIRED') throw transferExpired();
      if (status !== 'PENDING_OTP') throw transferNotPending(status);
      const issued = await codes.reissue(tx, 'TRANSFER_CONFIRMATION', id, otpPolicy);
      if (!issued) {
        throw new DomainError('RESEND_LIMIT_REACHED', 'Ya no quedan reenvíos para este código');
      }
      await store.awaitOtp(tx, id, issued.expiresAt);
      await audit.record(tx, {
        action: 'TRANSFER_OTP_RESENT',
        actor: { type: 'USER', userId },
        entity: { type: 'transfer', id },
        metadata: {
          channel: 'EMAIL',
          expiresAt: issued.expiresAt.toISOString(),
          resendsRemaining: issued.resendsRemaining,
        },
      });
      return issued.code;
    });
    const details = await this.deps.details.find(id);
    if (!details) throw new Error('La transferencia pendiente no existe');
    const delivery = await this.deps.otpMail.send(details, code);
    return otpChallenge(details, otpPolicy, delivery);
  }
}
