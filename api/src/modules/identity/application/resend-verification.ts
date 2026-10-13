import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import type { Mailer } from '../../../platform/mail/mailer.js';
import type { AppLogger } from '../../../shared/logger.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { verificationCodeEmail } from './email-templates.js';
import { EMAIL_VERIFICATION_POLICY, type OneTimeCodeService } from './one-time-codes.js';
import type { UserRepository } from './users.js';

export interface ResendVerificationDeps {
  readonly transactions: TransactionRunner;
  readonly users: UserRepository;
  readonly codes: OneTimeCodeService;
  readonly audit: AuditWriter;
  readonly mailer: Mailer;
  readonly logger: AppLogger;
}

/**
 * `POST /auth/verify-email/resend` (IDN-07): responde siempre lo mismo. Solo si el email es de un
 * usuario sin verificar y quedan reenvíos, emite un código nuevo (el anterior deja de servir),
 * audita `EMAIL_VERIFICATION_RESENT` y lo envía después del COMMIT.
 */
export class ResendVerification {
  constructor(private readonly deps: ResendVerificationDeps) {}

  async execute(input: { readonly email: string }): Promise<void> {
    const { transactions, users, codes, audit } = this.deps;
    const toSend = await transactions.run(async (tx) => {
      const user = await users.findByEmailForUpdate(tx, input.email);
      if (!user || user.emailVerifiedAt) return null;
      const issued = await codes.reissue(
        tx,
        'EMAIL_VERIFICATION',
        user.id,
        EMAIL_VERIFICATION_POLICY,
      );
      if (!issued) return null;
      await audit.record(tx, {
        action: 'EMAIL_VERIFICATION_RESENT',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id: user.id },
        metadata: { trigger: 'RESEND', resendsRemaining: issued.resendsRemaining },
      });
      return { fullName: user.fullName, code: issued.code };
    });
    if (!toSend) return;
    const content = verificationCodeEmail({
      ...toSend,
      minutes: EMAIL_VERIFICATION_POLICY.ttlMs / 60_000,
    });
    await deliverAfterCommit(
      this.deps.mailer,
      this.deps.logger,
      { to: input.email, ...content },
      'verification-code',
    );
  }
}
