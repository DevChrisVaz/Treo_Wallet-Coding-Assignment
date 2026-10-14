import { randomUUID } from 'node:crypto';
import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { DeliveryStatus } from '../../../platform/mail/mailer.js';
import type { Clock } from '../../../shared/clock.js';
import type { DomainError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type {
  CodePolicy,
  IssuedCode,
  OneTimeCodeService,
} from '../../identity/application/one-time-codes.js';
import { transferFingerprint } from '../domain/fingerprint.js';
import type { TransferDestinationResolver, TransferRequest } from './destination-resolver.js';
import type { IdempotencyGate } from './idempotency-gate.js';
import type { RejectionReason, TransferRow, TransferStore } from './ports.js';
import type { LedgerPoster } from './ledger-poster.js';
import type { TransferOtpMailer } from './transfer-emails.js';
import { balanceOrLimitError } from './transfer-errors.js';
import {
  toTransferView,
  type TransferDetails,
  type TransferDetailsReader,
} from './transfer-view.js';
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
  /** Códigos de un solo uso (propósito TRANSFER_CONFIRMATION) y su política. */
  readonly codes: OneTimeCodeService;
  readonly otpPolicy: CodePolicy;
  readonly poster: LedgerPoster;
  readonly counter: DailyUsageCounter;
  /** Transferencia con su destino y su desafío: comprobante y datos del correo del OTP. */
  readonly details: TransferDetailsReader;
  readonly otpMail: TransferOtpMailer;
  /** Lo que queda del límite de hoy (para repetir un rechazo por límite). */
  readonly remainingToday: (userId: string) => Promise<Money>;
}

export type CreateTransferOutcome =
  | { readonly kind: 'CREATED'; readonly transfer: Transfer }
  | { readonly kind: 'REPLAYED'; readonly transfer: Transfer }
  | { readonly kind: 'REJECTED'; readonly error: DomainError; readonly replayed: boolean };

type AttemptResult =
  | { readonly kind: 'REPLAY'; readonly existing: TransferRow }
  | { readonly kind: 'CREATED'; readonly transferId: string; readonly otp: IssuedCode | null }
  | {
      readonly kind: 'REJECTED';
      readonly transferId: string;
      readonly reason: RejectionReason;
      readonly remaining: Money | null;
    };

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
    const { codes, otpPolicy } = this.deps;
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
        return { kind: 'CREATED', transferId: id, otp: null };
      }
      // Camino con OTP (TRF-14): sin asientos ni contador; el dinero se mueve al confirmar.
      const otp = await codes.issue(tx, 'TRANSFER_CONFIRMATION', id, otpPolicy);
      await store.awaitOtp(tx, id, otp.expiresAt);
      await audit.record(tx, {
        action: 'TRANSFER_CREATED',
        actor: { type: 'USER', userId: draft.userId },
        entity: { type: 'transfer', id },
        metadata: { status: 'PENDING_OTP', kind: draft.kind, amount },
      });
      await audit.record(tx, {
        action: 'TRANSFER_OTP_SENT',
        actor: { type: 'USER', userId: draft.userId },
        entity: { type: 'transfer', id },
        metadata: { channel: 'EMAIL', expiresAt: otp.expiresAt.toISOString() },
      });
      return { kind: 'CREATED', transferId: id, otp };
    });
  }

  private async toOutcome(userId: string, result: AttemptResult): Promise<CreateTransferOutcome> {
    if (result.kind === 'CREATED') {
      const details = await this.load(result.transferId);
      // El correo sale después del COMMIT; si falla, la transferencia sigue pendiente (TRF-15).
      const delivery = result.otp
        ? await this.deps.otpMail.send(details, result.otp.code)
        : undefined;
      return { kind: 'CREATED', transfer: this.toView(details, delivery) };
    }
    if (result.kind === 'REJECTED') {
      return {
        kind: 'REJECTED',
        error: balanceOrLimitError(result.reason, result.transferId, result.remaining),
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
        error: balanceOrLimitError(existing.rejectionReason, existing.id, remaining),
        replayed: true,
      };
    }
    return { kind: 'REPLAYED', transfer: this.toView(await this.load(existing.id)) };
  }

  private async load(transferId: string): Promise<TransferDetails> {
    const details = await this.deps.details.find(transferId);
    if (!details) throw new Error('La transferencia recién guardada no existe');
    return details;
  }

  private toView(details: TransferDetails, deliveryStatus?: DeliveryStatus): Transfer {
    return toTransferView(details, this.deps.clock.now(), this.deps.otpPolicy, deliveryStatus);
  }
}
