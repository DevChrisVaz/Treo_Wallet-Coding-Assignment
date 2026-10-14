import { randomUUID } from 'node:crypto';
import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { transferFingerprint } from '../domain/fingerprint.js';
import type { TransferDestinationResolver, TransferRequest } from './destination-resolver.js';
import type { IdempotencyGate } from './idempotency-gate.js';
import type { RejectionReason, TransferRow, TransferStore } from './ports.js';
import type { LedgerPoster } from './ledger-poster.js';
import {
  DayChangedWhileWaiting,
  type DailyUsageCounter,
  type TransferLocker,
} from './transfer-locker.js';

export interface CreateTransferDeps {
  readonly transactions: TransactionRunner;
  readonly destinations: TransferDestinationResolver;
  readonly gate: IdempotencyGate;
  readonly locker: TransferLocker;
  readonly store: TransferStore;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly otpThreshold: Money;
  /** Estado actual de la transferencia como la ve su dueño (comprobante). */
  readonly poster: LedgerPoster;
  readonly counter: DailyUsageCounter;
  readonly view: (transferId: string) => Promise<Transfer>;
  /** Lo que queda del límite de hoy (para repetir un rechazo por límite). */
  readonly remainingToday: (userId: string) => Promise<Money>;
}

export type CreateTransferOutcome =
  | { readonly kind: 'CREATED'; readonly transfer: Transfer }
  | { readonly kind: 'REPLAYED'; readonly transfer: Transfer }
  | { readonly kind: 'REJECTED'; readonly error: DomainError; readonly replayed: boolean };

type AttemptResult =
  | { readonly kind: 'REPLAY'; readonly existing: TransferRow }
  | { readonly kind: 'CREATED'; readonly transferId: string }
  | {
      readonly kind: 'REJECTED';
      readonly transferId: string;
      readonly reason: RejectionReason;
      readonly remaining: Money | null;
    };

function rejection(
  reason: RejectionReason,
  transferId: string,
  remaining: Money | null,
): DomainError {
  return reason === 'INSUFFICIENT_FUNDS'
    ? new DomainError(
        'INSUFFICIENT_FUNDS',
        'El saldo de la cuenta no alcanza para esta transferencia',
        {
          transferId,
        },
      )
    : new DomainError('DAILY_LIMIT_EXCEEDED', 'La transferencia excede tu límite diario', {
        transferId,
        remaining: (remaining ?? Money.ZERO).toDecimalString(),
      });
}

/**
 * `POST /transfers` (TRF-01 a TRF-14, TRF-24, TRF-25). Resuelve destino y propiedad sin consumir la
 * llave; en una transacción reclama la llave, toma los bloqueos en orden global, valida saldo y
 * límite bajo bloqueo y decide: rechazo persistido como REJECTED, ejecución inmediata o espera de
 * OTP. Si la medianoche de CDMX llega mientras espera los bloqueos, revierte y reintenta una vez.
 */
export class CreateTransfer {
  constructor(private readonly deps: CreateTransferDeps) {}

  async execute(
    userId: string,
    idempotencyKey: string,
    request: TransferRequest,
  ): Promise<CreateTransferOutcome> {
    const route = await this.deps.destinations.resolve(userId, request);
    const fingerprint = transferFingerprint({
      fromAccountId: request.fromAccountId,
      destination: request.destination,
      amount: request.amount,
      concept: request.concept,
      reference: String(request.reference),
    });
    const draft = {
      userId,
      idempotencyKey,
      fingerprint,
      kind: route.kind,
      fromAccountId: route.fromAccountId,
      toAccountId: route.toAccountId,
      beneficiaryId: route.beneficiaryId,
      amount: request.amount,
      concept: request.concept,
      reference: request.reference,
    };
    let result: AttemptResult;
    try {
      result = await this.attempt(draft);
    } catch (error) {
      if (!(error instanceof DayChangedWhileWaiting)) throw error;
      result = await this.attempt(draft);
    }
    return this.toOutcome(userId, result);
  }

  private attempt(draft: {
    userId: string;
    idempotencyKey: string;
    fingerprint: string;
    kind: 'OWN' | 'THIRD_PARTY';
    fromAccountId: string;
    toAccountId: string;
    beneficiaryId: string | null;
    amount: Money;
    concept: string;
    reference: number;
  }): Promise<AttemptResult> {
    const { transactions, gate, locker, store, audit, clock, otpThreshold, poster, counter } =
      this.deps;
    return transactions.run(async (tx): Promise<AttemptResult> => {
      const id = randomUUID();
      const claim = await gate.claim(tx, {
        id,
        userId: draft.userId,
        idempotencyKey: draft.idempotencyKey,
        fingerprint: draft.fingerprint,
        kind: draft.kind,
        // Provisional: el estado definitivo se fija antes del COMMIT, así que nadie lo ve.
        status: 'PENDING_OTP',
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
        beneficiaryId: draft.beneficiaryId,
        amountCents: draft.amount.cents,
        concept: draft.concept,
        reference: draft.reference,
        requiresOtp: draft.amount.isGreaterThan(otpThreshold),
        rejectionReason: null,
        failureReason: null,
        otpExpiresAt: null,
        createdAt: clock.now(),
        completedAt: null,
      });
      if (claim.kind === 'REPLAY') return claim;

      const locks = await locker.acquire(tx, draft.userId, {
        kind: draft.kind,
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
        beneficiaryId: draft.beneficiaryId,
      });

      let reason: RejectionReason | null = null;
      let remaining: Money | null = null;
      if (locks.from.balance.isLessThan(draft.amount)) reason = 'INSUFFICIENT_FUNDS';
      else if (
        locks.counter &&
        locks.counter.used.plus(draft.amount).isGreaterThan(locks.counter.limit)
      ) {
        reason = 'DAILY_LIMIT_EXCEEDED';
        remaining = locks.counter.limit.minus(locks.counter.used);
      }
      const amount = draft.amount.toDecimalString();
      if (reason) {
        await store.reject(tx, id, reason);
        await audit.record(tx, {
          action: 'TRANSFER_CREATED',
          actor: { type: 'USER', userId: draft.userId },
          entity: { type: 'transfer', id },
          metadata: { status: 'REJECTED', kind: draft.kind, amount },
        });
        await audit.record(tx, {
          action: 'TRANSFER_REJECTED',
          actor: { type: 'USER', userId: draft.userId },
          entity: { type: 'transfer', id },
          metadata: { reason, amount },
        });
        return { kind: 'REJECTED', transferId: id, reason, remaining };
      }
      if (!draft.amount.isGreaterThan(otpThreshold)) {
        // Camino inmediato (TRF-01, TRF-21, TRF-22): asientos, saldos, contador y COMPLETED juntos.
        await poster.post(tx, {
          transferId: id,
          kind: draft.kind,
          from: locks.from,
          to: locks.to,
          amount: draft.amount,
          at: locks.at,
        });
        if (locks.counter) await counter.add(tx, draft.userId, locks.day, draft.amount);
        await audit.record(tx, {
          action: 'TRANSFER_CREATED',
          actor: { type: 'USER', userId: draft.userId },
          entity: { type: 'transfer', id },
          metadata: { status: 'COMPLETED', kind: draft.kind, amount },
        });
        await audit.record(tx, {
          action: 'TRANSFER_COMPLETED',
          actor: { type: 'USER', userId: draft.userId },
          entity: { type: 'transfer', id },
          metadata: { kind: draft.kind, amount },
        });
        return { kind: 'CREATED', transferId: id };
      }
      throw new Error('Camino con OTP pendiente');
    });
  }

  private async toOutcome(userId: string, result: AttemptResult): Promise<CreateTransferOutcome> {
    if (result.kind === 'CREATED') {
      return { kind: 'CREATED', transfer: await this.deps.view(result.transferId) };
    }
    if (result.kind === 'REJECTED') {
      return {
        kind: 'REJECTED',
        error: rejection(result.reason, result.transferId, result.remaining),
        replayed: false,
      };
    }
    const existing = result.existing;
    if (existing.status === 'REJECTED' && existing.rejectionReason) {
      const remaining =
        existing.rejectionReason === 'DAILY_LIMIT_EXCEEDED'
          ? await this.deps.remainingToday(userId)
          : null;
      return {
        kind: 'REJECTED',
        error: rejection(existing.rejectionReason, existing.id, remaining),
        replayed: true,
      };
    }
    return { kind: 'REPLAYED', transfer: await this.deps.view(existing.id) };
  }
}
