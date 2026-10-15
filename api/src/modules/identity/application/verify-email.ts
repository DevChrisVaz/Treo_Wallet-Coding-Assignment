import type { AuthSession } from '@devchrisvaz/wallet-contract';
import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import type { Mailer } from '../../../platform/mail/mailer.js';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { AppLogger } from '../../../shared/logger.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { OpenDefaultAccounts } from '../../accounts/application/open-default-accounts.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { identityUseAttemptEmail } from './email-templates.js';
import { EMAIL_VERIFICATION_POLICY, type OneTimeCodeService } from './one-time-codes.js';
import type { IssuedRefreshToken, SessionService } from './sessions.js';
import type { AccessTokens } from './tokens.js';
import { toAuthSession } from './user-view.js';
import type { UserRecord, UserRepository } from './users.js';

export interface VerifyEmailDeps {
  readonly transactions: TransactionRunner;
  readonly users: UserRepository;
  readonly codes: OneTimeCodeService;
  readonly openAccounts: OpenDefaultAccounts;
  readonly sessions: SessionService;
  readonly accessTokens: AccessTokens;
  readonly audit: AuditWriter;
  readonly mailer: Mailer;
  readonly logger: AppLogger;
  readonly clock: Clock;
}

/**
 * Respuesta para un email desconocido o ya verificado: la misma que el primer código incorrecto de
 * un registro real, para no revelar el motivo (IDN-06).
 */
const UNKNOWN_EMAIL_ATTEMPTS_REMAINING = EMAIL_VERIFICATION_POLICY.maxAttempts - 1;

type Result =
  | { readonly kind: 'VERIFIED'; readonly user: UserRecord; readonly session: IssuedRefreshToken }
  | { readonly kind: 'IN_REVIEW'; readonly ownerEmails: readonly string[] }
  | { readonly kind: 'INVALID'; readonly attemptsRemaining: number };

function invalidCode(attemptsRemaining: number): DomainError {
  return new DomainError('VERIFICATION_CODE_INVALID', 'El código no es válido o ya venció', {
    attemptsRemaining,
  });
}

/**
 * `POST /auth/verify-email` (IDN-06, ACC-04, AUD-03). En una sola transacción, con usuario y
 * desafío bloqueados: valida el código, marca el correo como verificado, consume el código, abre
 * "Principal" y "Ahorro", crea la familia de refresh y audita `EMAIL_VERIFIED`. Un intento fallido
 * se confirma (el contador avanza) y la respuesta es 422 con los intentos restantes.
 *
 * Un usuario en revisión (IDN-03) verifica el correo, pero no abre cuentas ni sesión: se audita
 * `REGISTRATION_IN_REVIEW` con los datos que chocaron, después del COMMIT se avisa a cada dueño de
 * esos datos (IDN-16) y la respuesta es `403 REGISTRATION_IN_REVIEW`.
 */
export class VerifyEmail {
  constructor(private readonly deps: VerifyEmailDeps) {}

  async execute(input: { readonly email: string; readonly code: string }): Promise<AuthSession> {
    const { transactions, users, codes, openAccounts, sessions, audit, clock } = this.deps;
    const result = await transactions.run(async (tx): Promise<Result> => {
      const user = await users.findByEmailForUpdate(tx, input.email);
      if (!user || user.emailVerifiedAt) {
        return { kind: 'INVALID', attemptsRemaining: UNKNOWN_EMAIL_ATTEMPTS_REMAINING };
      }
      const check = await codes.verify(
        tx,
        'EMAIL_VERIFICATION',
        user.id,
        input.code,
        EMAIL_VERIFICATION_POLICY,
      );
      if (check.status !== 'VALID') {
        if (check.status === 'INVALID') {
          await audit.record(tx, {
            action: check.exhausted ? 'OTP_ATTEMPTS_EXHAUSTED' : 'OTP_ATTEMPT_FAILED',
            actor: { type: 'ANONYMOUS' },
            entity: { type: 'user', id: user.id },
            metadata: { purpose: 'EMAIL_VERIFICATION', attemptsRemaining: check.attemptsRemaining },
          });
        }
        return { kind: 'INVALID', attemptsRemaining: check.attemptsRemaining };
      }
      const verifiedAt = clock.now();
      await users.markEmailVerified(tx, user.id, verifiedAt);
      if (user.identityConflict) {
        const owners = await users.activeOwnersOf(tx, user);
        const taken = new Set(owners.flatMap((owner) => owner.fields));
        await audit.record(tx, {
          action: 'REGISTRATION_IN_REVIEW',
          actor: { type: 'USER', userId: user.id },
          entity: { type: 'user', id: user.id },
          metadata: {
            curpTaken: taken.has('curp'),
            rfcTaken: taken.has('rfc'),
            phoneTaken: taken.has('phone'),
          },
        });
        return { kind: 'IN_REVIEW', ownerEmails: owners.map((owner) => owner.email) };
      }
      await openAccounts.execute(tx, user.id);
      const session = await sessions.start(tx, user.id);
      await audit.record(tx, {
        action: 'EMAIL_VERIFIED',
        actor: { type: 'USER', userId: user.id },
        entity: { type: 'user', id: user.id },
      });
      return { kind: 'VERIFIED', user: { ...user, emailVerifiedAt: verifiedAt }, session };
    });

    if (result.kind === 'INVALID') throw invalidCode(result.attemptsRemaining);
    if (result.kind === 'IN_REVIEW') {
      for (const to of result.ownerEmails) {
        await deliverAfterCommit(
          this.deps.mailer,
          this.deps.logger,
          { to, ...identityUseAttemptEmail() },
          'identity-use-attempt',
          { level: 'warn' },
        );
      }
      throw new DomainError('REGISTRATION_IN_REVIEW', 'Tu registro está en revisión');
    }
    const access = await this.deps.accessTokens.issue(result.user.id, clock.now());
    return toAuthSession(result.user, access, result.session);
  }
}
