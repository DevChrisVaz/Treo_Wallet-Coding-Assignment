import type { Clock } from '../../../shared/clock.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { hashRefreshToken, type RefreshTokenStore } from './sessions.js';

export interface LogoutDeps {
  readonly transactions: TransactionRunner;
  readonly store: RefreshTokenStore;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

/**
 * `POST /auth/logout` (IDN-13): revoca la familia del refresh token recibido. Es idempotente: un
 * token desconocido, ya revocado o vencido no cambia nada y la respuesta es la misma. `LOGOUT` se
 * audita solo cuando efectivamente se revocó algo.
 */
export class Logout {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(input: { readonly refreshToken: string }): Promise<void> {
    const { transactions, store, audit, clock } = this.deps;
    await transactions.run(async (tx) => {
      const token = await store.findByHashForUpdate(tx, hashRefreshToken(input.refreshToken));
      if (!token) return;
      const revoked = await store.revokeFamily(tx, token.familyId, 'LOGOUT', clock.now());
      if (revoked === 0) return;
      await audit.record(tx, {
        action: 'LOGOUT',
        actor: { type: 'USER', userId: token.userId },
        entity: { type: 'user', id: token.userId },
        metadata: { familyId: token.familyId },
      });
    });
  }
}
