import { randomUUID } from 'node:crypto';
import type { DeliveryStatus, Mailer } from '../../../platform/mail/mailer.js';
import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import { composeFullName } from '../domain/full-name.js';
import type { Clock } from '../../../shared/clock.js';
import type { AppLogger } from '../../../shared/logger.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import {
  registrationAttemptEmail,
  verificationCodeEmail,
  type EmailContent,
} from './email-templates.js';
import { EMAIL_VERIFICATION_POLICY, type OneTimeCodeService } from './one-time-codes.js';
import type { PasswordHasher } from './ports.js';
import { EmailAlreadyTaken, IdentityAlreadyTaken, type UserRepository } from './users.js';

export interface RegisterUserInput {
  /** Ya normalizado (IDN-02). */
  readonly email: string;
  readonly password: string;
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname?: string | undefined;
  /** `YYYY-MM-DD`, igual a la fecha de la CURP. */
  readonly birthDate: string;
  /** Código de entidad, igual al de la CURP. */
  readonly birthState: string;
  readonly curp: string;
  readonly rfc: string;
  /** Ya en E.164. */
  readonly phone: string;
}

export interface RegisterUserDeps {
  readonly transactions: TransactionRunner;
  readonly users: UserRepository;
  readonly codes: OneTimeCodeService;
  readonly hasher: PasswordHasher;
  readonly audit: AuditWriter;
  readonly mailer: Mailer;
  readonly logger: AppLogger;
  readonly clock: Clock;
}

/** Qué correo corresponde, decidido dentro de la transacción y enviado después del COMMIT. */
type Outcome =
  | { readonly kind: 'CODE'; readonly fullName: string; readonly code: string }
  | { readonly kind: 'ALREADY_VERIFIED' }
  | { readonly kind: 'NOTHING' };

/**
 * `POST /auth/register` (IDN-01, IDN-02, IDN-03). Responde igual en todas las ramas; el caso de
 * uso solo decide qué hacer y qué correo enviar:
 * - email nuevo: crea el usuario sin verificar, emite el código y audita. Si su CURP, RFC o
 *   teléfono ya son de otro usuario activo (pre-chequeo o índice único), lo crea en revisión, con
 *   el mismo código y el mismo correo: nada distingue el caso hasta la verificación (IDN-06);
 * - email verificado: no cambia nada y avisa al dueño;
 * - email sin verificar: conserva los datos y reenvía un código (si quedan reenvíos).
 */
export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  async execute(input: RegisterUserInput): Promise<void> {
    // El hash se calcula siempre, antes de la transacción, para no retener bloqueos mientras tanto.
    const passwordHash = await this.deps.hasher.hash(input.password);
    let outcome: Outcome;
    try {
      outcome = await this.attempt(input, passwordHash, false);
    } catch (error) {
      // Otro registro activo con la misma CURP, RFC o teléfono ganó la carrera: este queda en revisión.
      if (error instanceof IdentityAlreadyTaken)
        outcome = await this.attempt(input, passwordHash, true);
      // Otro registro con el mismo email ganó la carrera: se repite y cae en la rama que toque.
      else if (error instanceof EmailAlreadyTaken)
        outcome = await this.attempt(input, passwordHash, false);
      else throw error;
    }
    await this.notify(input.email, outcome);
  }

  private attempt(
    input: RegisterUserInput,
    passwordHash: string,
    identityTaken: boolean,
  ): Promise<Outcome> {
    const { transactions, users, codes, audit, clock } = this.deps;
    return transactions.run(async (tx): Promise<Outcome> => {
      const existing = await users.findByEmailForUpdate(tx, input.email);
      if (existing?.emailVerifiedAt) return { kind: 'ALREADY_VERIFIED' };
      if (existing) {
        const issued = await codes.reissue(
          tx,
          'EMAIL_VERIFICATION',
          existing.id,
          EMAIL_VERIFICATION_POLICY,
        );
        if (!issued) return { kind: 'NOTHING' };
        await audit.record(tx, {
          action: 'EMAIL_VERIFICATION_RESENT',
          actor: { type: 'ANONYMOUS' },
          entity: { type: 'user', id: existing.id },
          metadata: { trigger: 'REGISTER', resendsRemaining: issued.resendsRemaining },
        });
        return { kind: 'CODE', fullName: existing.fullName, code: issued.code };
      }
      const identityConflict = identityTaken || (await users.identityInUse(tx, input));

      const id = randomUUID();
      const fullName = composeFullName(input);
      await users.insert(tx, {
        id,
        email: input.email,
        passwordHash,
        fullName,
        firstNames: input.firstNames,
        paternalSurname: input.paternalSurname,
        maternalSurname: input.maternalSurname ?? null,
        birthDate: input.birthDate,
        birthState: input.birthState,
        curp: input.curp,
        rfc: input.rfc,
        phone: input.phone,
        createdAt: clock.now(),
        identityConflict,
      });
      const issued = await codes.issue(tx, 'EMAIL_VERIFICATION', id, EMAIL_VERIFICATION_POLICY);
      await audit.record(tx, {
        action: 'USER_REGISTERED',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id },
        ...(identityConflict ? { metadata: { inReview: true } } : {}),
      });
      return { kind: 'CODE', fullName, code: issued.code };
    });
  }

  private async notify(email: string, outcome: Outcome): Promise<DeliveryStatus | undefined> {
    const content: [EmailContent, string] | undefined =
      outcome.kind === 'CODE'
        ? [
            verificationCodeEmail({
              fullName: outcome.fullName,
              code: outcome.code,
              minutes: EMAIL_VERIFICATION_POLICY.ttlMs / 60_000,
            }),
            'verification-code',
          ]
        : outcome.kind === 'ALREADY_VERIFIED'
          ? [registrationAttemptEmail(), 'registration-attempt']
          : undefined;
    if (!content) return undefined;
    const [mail, template] = content;
    return deliverAfterCommit(this.deps.mailer, this.deps.logger, { to: email, ...mail }, template);
  }
}
