import type { TokenPair } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import type { NoticeDispatcher } from '../../../platform/mail/notice-dispatcher.js';
import { DomainError } from '../../../shared/errors.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { sessionClosedEmail } from './email-templates.js';
import {
  hashRefreshToken,
  type IssuedRefreshToken,
  type RefreshTokenStore,
  type SessionService,
} from './sessions.js';
import type { AccessTokens } from './tokens.js';
import { toTokenPair } from './user-view.js';
import type { UserRepository } from './users.js';

/** Ventana para tolerar el reintento de un cliente que perdió la respuesta (IDN-12). */
export const REFRESH_GRACE_MS = 30_000;

export interface RefreshSessionDeps {
  readonly transactions: TransactionRunner;
  readonly store: RefreshTokenStore;
  readonly sessions: SessionService;
  readonly accessTokens: AccessTokens;
  readonly audit: AuditWriter;
  /** Para avisar al dueño de la sesión cuando se detecta un reuso (IDN-19). */
  readonly users: UserRepository;
  readonly notices: NoticeDispatcher;
  readonly clock: Clock;
}

type Outcome =
  | { readonly kind: 'ROTATED'; readonly userId: string; readonly next: IssuedRefreshToken }
  | { readonly kind: 'REVOKED'; readonly reusedBy?: string };

function sessionRevoked(): DomainError {
  return new DomainError('SESSION_REVOKED', 'La sesión ya no es válida; inicia sesión de nuevo');
}

/**
 * `POST /auth/refresh` (IDN-11, IDN-12). Todo ocurre con la fila del token bloqueada, así que dos
 * refresh simultáneos con el mismo token se procesan uno después del otro; "ahora" se toma después
 * de obtener el bloqueo.
 * - token vigente sin usar: emite el sucesor y marca el token como usado;
 * - token usado hace ≤ 30 s con sucesor sin usar (reintento): revoca ese sucesor y emite otro;
 * - cualquier otro uso de un token ya usado es reuso: revoca la familia, audita y responde 401;
 * - inexistente, revocado, vencido o con la familia vencida: 401 sin cambios.
 */
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(input: { readonly refreshToken: string }): Promise<TokenPair> {
    const { transactions, store, sessions, audit, clock } = this.deps;
    const outcome = await transactions.run(async (tx): Promise<Outcome> => {
      const token = await store.findByHashForUpdate(tx, hashRefreshToken(input.refreshToken));
      const now = clock.now();
      if (
        !token ||
        token.revokedAt ||
        token.expiresAt.getTime() <= now.getTime() ||
        token.familyExpiresAt.getTime() <= now.getTime()
      ) {
        return { kind: 'REVOKED' };
      }

      if (!token.usedAt) {
        const next = await sessions.issueInFamily(
          tx,
          token.userId,
          token.familyId,
          now,
          token.familyExpiresAt,
        );
        await store.markUsed(tx, token.id, now, next.id);
        return { kind: 'ROTATED', userId: token.userId, next };
      }

      if (now.getTime() - token.usedAt.getTime() <= REFRESH_GRACE_MS && token.replacedBy) {
        const successor = await store.findByIdForUpdate(tx, token.replacedBy);
        if (successor && !successor.usedAt && !successor.revokedAt) {
          await store.revoke(tx, successor.id, 'GRACE_SUPERSEDED', now);
          const next = await sessions.issueInFamily(
            tx,
            token.userId,
            token.familyId,
            now,
            token.familyExpiresAt,
          );
          await store.markUsed(tx, token.id, now, next.id);
          return { kind: 'ROTATED', userId: token.userId, next };
        }
      }

      await store.revokeFamily(tx, token.familyId, 'REUSE_DETECTED', now);
      await audit.record(tx, {
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        actor: { type: 'ANONYMOUS' },
        entity: { type: 'user', id: token.userId },
        metadata: { familyId: token.familyId },
      });
      return { kind: 'REVOKED', reusedBy: token.userId };
    });

    if (outcome.kind === 'REVOKED') {
      if (outcome.reusedBy) await this.notifyReuse(outcome.reusedBy);
      throw sessionRevoked();
    }
    const access = await this.deps.accessTokens.issue(outcome.userId, clock.now());
    return toTokenPair(access, outcome.next);
  }

  /**
   * Avisa al dueño después del COMMIT (IDN-19). Solo llega aquí el primer reuso: con la familia
   * revocada, el mismo token cae en la rama de "revocado" y no vuelve a avisar. Nada de esto cambia
   * el 401 que recibe quien presentó el token (PLT-16).
   */
  private async notifyReuse(userId: string): Promise<void> {
    const { users, notices, clock } = this.deps;
    const user = await users.findById(userId);
    if (!user) return;
    notices.send(
      { to: user.email, ...sessionClosedEmail({ at: clock.now() }) },
      'session-closed-notice',
    );
  }
}
