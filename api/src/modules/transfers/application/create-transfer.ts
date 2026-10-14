import { randomUUID } from 'node:crypto';
import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { DeliveryStatus } from '../../../platform/mail/mailer.js';
import type { Clock } from '../../../shared/clock.js';
import { DomainError, type FieldError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { Transaction, TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type {
  CodePolicy,
  IssuedCode,
  OneTimeCodeService,
} from '../../identity/application/one-time-codes.js';
import { transferFingerprint } from '../domain/fingerprint.js';
import {
  MAX_ACTIVE_SCHEDULED,
  scheduledAmountIssue,
  scheduledDateIssue,
} from '../domain/schedule.js';
import { declineFor, type Decline } from '../domain/settlement.js';
import type { TransferDestinationResolver, TransferRequest } from './destination-resolver.js';
import type { IdempotencyGate } from './idempotency-gate.js';
import type { LockedTransferExecutor } from './locked-transfer-executor.js';
import type { RejectionReason, ScheduledCap, TransferRow, TransferStore } from './ports.js';
import type { TransferOtpMailer } from './transfer-emails.js';
import { balanceOrLimitError } from './transfer-errors.js';
import {
  toTransferView,
  type TransferDetails,
  type TransferDetailsReader,
} from './transfer-view.js';
import { DayChangedWhileWaiting, type TransferLocker } from './transfer-locker.js';

export interface CreateTransferDeps {
  readonly transactions: TransactionRunner;
  readonly destinations: TransferDestinationResolver;
  readonly gate: IdempotencyGate;
  readonly locker: TransferLocker;
  readonly store: TransferStore;
  /** Tope de programadas activas por usuario (TRF-29). */
  readonly cap: ScheduledCap;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly otpThreshold: Money;
  /** Límite diario a terceros: una programada mayor nunca podría ejecutarse (TRF-27). */
  readonly dailyLimit: Money;
  /** Códigos de un solo uso (propósito TRANSFER_CONFIRMATION) y su política. */
  readonly codes: OneTimeCodeService;
  readonly otpPolicy: CodePolicy;
  /** Validación y asientos de una transferencia ya bloqueada, compartidos con el ejecutor. */
  readonly executor: LockedTransferExecutor;
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

/** Transferencia ya resuelta y con su huella, lista para reclamar la llave. */
interface Draft {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly kind: 'OWN' | 'THIRD_PARTY';
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly beneficiaryId: string | null;
  readonly amount: Money;
  readonly concept: string;
  readonly reference: number;
  readonly scheduledFor: string | null;
}

/**
 * `POST /transfers` (TRF-01 a TRF-14, TRF-24, TRF-25, TRF-27). Resuelve destino y propiedad sin
 * consumir la llave; en una transacción reclama la llave y, si es inmediata, toma los bloqueos en
 * orden global, valida saldo y límite bajo bloqueo y decide: rechazo persistido como REJECTED,
 * ejecución inmediata o espera de OTP. Si la medianoche de CDMX llega mientras espera los bloqueos,
 * revierte y reintenta una vez. Una programada no toca saldo, límite ni cuentas: queda en
 * SCHEDULED hasta su fecha.
 */
export class CreateTransfer {
  constructor(private readonly deps: CreateTransferDeps) {}

  async execute(
    userId: string,
    idempotencyKey: string,
    request: TransferRequest,
  ): Promise<CreateTransferOutcome> {
    const route = await this.deps.destinations.resolve(userId, request);
    const scheduledFor = request.scheduledFor ?? null;
    const fingerprint = transferFingerprint({
      fromAccountId: request.fromAccountId,
      destination: request.destination,
      amount: request.amount,
      concept: request.concept,
      reference: String(request.reference),
      scheduledFor,
    });
    const draft: Draft = {
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
      scheduledFor,
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

  private attempt(draft: Draft): Promise<AttemptResult> {
    const { transactions, gate, locker, audit, clock, otpThreshold, executor } = this.deps;
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
        scheduledFor: draft.scheduledFor,
        cancelledAt: null,
      });
      if (claim.kind === 'REPLAY') return claim;
      if (draft.scheduledFor !== null) return this.schedule(tx, id, draft, draft.scheduledFor);

      const locks = await locker.acquire(tx, draft.userId, {
        kind: draft.kind,
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
        beneficiaryId: draft.beneficiaryId,
      });

      const amount = draft.amount.toDecimalString();
      if (!draft.amount.isGreaterThan(otpThreshold)) {
        // Camino inmediato (TRF-01, TRF-21, TRF-22): asientos, saldos, contador y COMPLETED juntos,
        // con el mismo servicio que la confirmación y el ejecutor de programadas.
        const execution = await executor.execute(tx, {
          transferId: id,
          userId: draft.userId,
          kind: draft.kind,
          amount: draft.amount,
          locks,
        });
        if (execution.kind === 'DECLINED') return this.reject(tx, id, draft, execution);
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
      // Camino con OTP (TRF-14): valida saldo y límite antes de crearla, sin asientos ni contador;
      // el dinero se mueve al confirmar.
      const decline = declineFor({
        balance: locks.from.balance,
        amount: draft.amount,
        usage: locks.counter,
      });
      if (decline) return this.reject(tx, id, draft, decline);
      return this.awaitOtp(tx, id, draft);
    });
  }

  /** Rechazo de negocio al crear (TRF-10, TRF-11): REJECTED con su motivo, sin asientos. */
  private async reject(
    tx: Transaction,
    id: string,
    draft: Draft,
    decline: Decline,
  ): Promise<AttemptResult> {
    const { store, audit } = this.deps;
    const actor = { type: 'USER' as const, userId: draft.userId };
    const entity = { type: 'transfer', id };
    const amount = draft.amount.toDecimalString();
    await store.reject(tx, id, decline.reason);
    await audit.record(tx, {
      action: 'TRANSFER_CREATED',
      actor,
      entity,
      metadata: { status: 'REJECTED', kind: draft.kind, amount },
    });
    await audit.record(tx, {
      action: 'TRANSFER_REJECTED',
      actor,
      entity,
      metadata: { reason: decline.reason, amount },
    });
    return {
      kind: 'REJECTED',
      transferId: id,
      reason: decline.reason,
      remaining: decline.remaining,
    };
  }

  /**
   * Deja la transferencia en PENDING_OTP con su código (TRF-14, TRF-28) y audita su creación y el
   * envío; el correo sale después del COMMIT. Una programada lleva su fecha en los metadatos.
   */
  private async awaitOtp(tx: Transaction, id: string, draft: Draft): Promise<AttemptResult> {
    const { codes, otpPolicy, store, audit } = this.deps;
    const actor = { type: 'USER' as const, userId: draft.userId };
    const entity = { type: 'transfer', id };
    const otp = await codes.issue(tx, 'TRANSFER_CONFIRMATION', id, otpPolicy);
    await store.awaitOtp(tx, id, otp.expiresAt);
    await audit.record(tx, {
      action: 'TRANSFER_CREATED',
      actor,
      entity,
      metadata: {
        status: 'PENDING_OTP',
        kind: draft.kind,
        amount: draft.amount.toDecimalString(),
        ...(draft.scheduledFor === null ? {} : { scheduledFor: draft.scheduledFor }),
      },
    });
    await audit.record(tx, {
      action: 'TRANSFER_OTP_SENT',
      actor,
      entity,
      metadata: { channel: 'EMAIL', expiresAt: otp.expiresAt.toISOString() },
    });
    return { kind: 'CREATED', transferId: id, otp };
  }

  /**
   * Camino programado (TRF-27, D4), dentro de la transacción del reclamo y sin bloqueos de saldo ni
   * de límite: ambos se validan al ejecutar. La fecha y el monto se validan aquí, después del
   * reclamo, y no antes: un reintento que llega pasada la medianoche se reconoce como reintento (la
   * original ya pasó la validación) en lugar de responder que su fecha ya no es programable. Una
   * petición nueva inválida lanza y revierte el reclamo, así que la llave no se consume.
   *
   * El tope de programadas (D8) se revisa con la fila del usuario bloqueada: dos programaciones
   * simultáneas del mismo usuario hacen fila y la segunda cuenta a la primera ya confirmada. Al
   * llegar al tope también se lanza: no se guarda la transferencia y la llave queda libre.
   */
  private async schedule(
    tx: Transaction,
    id: string,
    draft: Draft,
    scheduledFor: string,
  ): Promise<AttemptResult> {
    const { store, cap, audit, clock, otpThreshold, dailyLimit } = this.deps;
    const issues = [
      scheduledDateIssue(scheduledFor, clock),
      scheduledAmountIssue(draft.kind, draft.amount, dailyLimit),
    ].filter((issue): issue is FieldError => issue !== null);
    if (issues.length > 0) {
      throw new DomainError('VALIDATION_FAILED', 'Revisa los campos marcados', { errors: issues });
    }
    await cap.lockOwner(tx, draft.userId);
    if ((await cap.countActive(tx, draft.userId, clock.now(), id)) >= MAX_ACTIVE_SCHEDULED) {
      throw new DomainError(
        'SCHEDULED_LIMIT_REACHED',
        `Ya tienes ${MAX_ACTIVE_SCHEDULED} transferencias programadas; cancela una para programar otra`,
      );
    }
    // Arriba del umbral se confirma con OTP y queda SCHEDULED al confirmar (TRF-28).
    if (draft.amount.isGreaterThan(otpThreshold)) return this.awaitOtp(tx, id, draft);
    const actor = { type: 'USER' as const, userId: draft.userId };
    const entity = { type: 'transfer', id };
    const amount = draft.amount.toDecimalString();
    await store.schedule(tx, id);
    await audit.record(tx, {
      action: 'TRANSFER_CREATED',
      actor,
      entity,
      metadata: { status: 'SCHEDULED', kind: draft.kind, amount, scheduledFor },
    });
    await audit.record(tx, {
      action: 'TRANSFER_SCHEDULED',
      actor,
      entity,
      metadata: { kind: draft.kind, amount, scheduledFor },
    });
    return { kind: 'CREATED', transferId: id, otp: null };
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
