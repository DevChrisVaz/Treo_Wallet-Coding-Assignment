import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { LockedAccount } from '../domain/ledger.js';
import type { LedgerPoster } from './ledger-poster.js';
import type { AccountLocks, TransferStore } from './ports.js';

export interface FundAccountDeps {
  readonly transactions: TransactionRunner;
  readonly transfers: TransferStore;
  readonly locks: AccountLocks;
  readonly poster: LedgerPoster;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export interface FundingResult {
  readonly transferId: string;
  readonly balanceAfter: Money;
}

/**
 * Fondeo desde la Tesorería (ACC-15): la única forma de que entre dinero a una cuenta USER. Una
 * transferencia `FUNDING` con dos asientos (Tesorería en negativo, `DEPOSIT` en la cuenta) y el
 * evento `FUNDING_POSTED` con actor SYSTEM, en la misma transacción. Lo usan el seed y `db:fund`;
 * no hay endpoint HTTP que cree dinero.
 */
export class FundAccount {
  constructor(private readonly deps: FundAccountDeps) {}

  async execute(input: {
    readonly account: string;
    readonly amount: Money;
    readonly concept?: string;
  }): Promise<FundingResult> {
    const { transactions, transfers, locks, poster, audit, clock } = this.deps;
    const accountId = await locks.findUserAccount(input.account);
    if (!accountId) throw new DomainError('NOT_FOUND', 'La cuenta a fondear no existe');

    return transactions.run(async (tx) => {
      const treasuryId = await locks.treasuryId(tx);
      const transferId = randomUUID();
      // Fila provisional: el poster la completa en esta misma transacción.
      await transfers.insert(tx, {
        id: transferId,
        userId: null,
        idempotencyKey: null,
        fingerprint: null,
        kind: 'FUNDING',
        status: 'PENDING_OTP',
        fromAccountId: treasuryId,
        toAccountId: accountId,
        beneficiaryId: null,
        amountCents: input.amount.cents,
        concept: input.concept ?? 'Fondeo de la Tesorería',
        reference: null,
        requiresOtp: false,
        rejectionReason: null,
        failureReason: null,
        otpExpiresAt: null,
        createdAt: clock.now(),
        completedAt: null,
        scheduledFor: null,
        cancelledAt: null,
      });
      const locked = await locks.lock(tx, [treasuryId, accountId]);
      const byId = new Map(locked.map((account) => [account.id, account]));
      const result = await poster.post(tx, {
        transferId,
        kind: 'FUNDING',
        from: byId.get(treasuryId) as LockedAccount,
        to: byId.get(accountId) as LockedAccount,
        amount: input.amount,
        at: clock.now(),
      });
      await audit.record(tx, {
        action: 'FUNDING_POSTED',
        actor: { type: 'SYSTEM' },
        entity: { type: 'transfer', id: transferId },
        metadata: { accountId, amount: input.amount.toDecimalString() },
      });
      return { transferId, balanceAfter: result.toBalanceAfter };
    });
  }
}
