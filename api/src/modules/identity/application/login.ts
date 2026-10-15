import type { AuthSession } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import { maskIp } from '../../../shared/masking.js';
import type { NoticeDispatcher } from '../../../platform/mail/notice-dispatcher.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { describeClient } from './client-description.js';
import { loginNoticeEmail } from './email-templates.js';
import type { PasswordHasher } from './ports.js';
import type { SessionService } from './sessions.js';
import type { AccessTokens } from './tokens.js';
import { toAuthSession } from './user-view.js';
import type { UserRepository } from './users.js';

export interface LoginDeps {
  readonly transactions: TransactionRunner;
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly sessions: SessionService;
  readonly accessTokens: AccessTokens;
  readonly audit: AuditWriter;
  /** Avisos que no hacen esperar la respuesta (IDN-18). */
  readonly notices: NoticeDispatcher;
  readonly clock: Clock;
}

/** Lo que la petición sabe del cliente: la IP según `trust proxy` y su `User-Agent`. */
export interface LoginClient {
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
}

function invalidCredentials(): DomainError {
  return new DomainError('INVALID_CREDENTIALS', 'El email o la contraseña no son correctos');
}

/**
 * `POST /auth/login` (IDN-08). Un email inexistente y una contraseña incorrecta responden el mismo
 * 401 y ambos verifican un hash argon2id (el ficticio cuando el email no existe), para que tarden
 * lo mismo. Con contraseña correcta y correo sin verificar responde 403. Los fallos se auditan por
 * separado (`LOGIN_FAILED`, sin cambio de negocio); el éxito crea la familia de refresh y audita
 * `LOGIN_SUCCEEDED` en la misma transacción y, después, avisa por correo sin hacer esperar la
 * respuesta (IDN-18).
 */
export class Login {
  constructor(private readonly deps: LoginDeps) {}

  async execute(
    input: {
      readonly email: string;
      readonly password: string;
    },
    client: LoginClient = {},
  ): Promise<AuthSession> {
    const { users, hasher, audit, transactions, sessions, clock } = this.deps;
    const user = await users.findByEmail(input.email);
    if (!user) {
      await hasher.verifyDummy(input.password);
      await audit.recordStandalone({
        action: 'LOGIN_FAILED',
        actor: { type: 'ANONYMOUS' },
        metadata: { reason: 'UNKNOWN_EMAIL' },
      });
      throw invalidCredentials();
    }
    if (!(await hasher.verify(user.passwordHash, input.password))) {
      await audit.recordStandalone({
        action: 'LOGIN_FAILED',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id: user.id },
        metadata: { reason: 'INVALID_PASSWORD' },
      });
      throw invalidCredentials();
    }
    if (!user.emailVerifiedAt) {
      await audit.recordStandalone({
        action: 'LOGIN_FAILED',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id: user.id },
        metadata: { reason: 'EMAIL_NOT_VERIFIED' },
      });
      throw new DomainError('EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de iniciar sesión');
    }
    // Registro en revisión (IDN-03): solo lo sabe quien conoce la contraseña.
    if (user.identityConflict) {
      await audit.recordStandalone({
        action: 'LOGIN_FAILED',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id: user.id },
        metadata: { reason: 'REGISTRATION_IN_REVIEW' },
      });
      throw new DomainError('REGISTRATION_IN_REVIEW', 'Tu registro está en revisión');
    }

    const session = await transactions.run(async (tx) => {
      const started = await sessions.start(tx, user.id);
      await audit.record(tx, {
        action: 'LOGIN_SUCCEEDED',
        actor: { type: 'USER', userId: user.id },
        entity: { type: 'user', id: user.id },
      });
      return started;
    });
    const access = await this.deps.accessTokens.issue(user.id, clock.now());
    // Después del COMMIT y sin esperar al servidor de correo (IDN-18, PLT-16).
    this.deps.notices.send(
      {
        to: user.email,
        ...loginNoticeEmail({
          at: clock.now(),
          client: describeClient(client.userAgent).text,
          maskedIp: maskIp(client.ip),
        }),
      },
      'login-notice',
    );
    return toAuthSession(user, access, session);
  }
}
