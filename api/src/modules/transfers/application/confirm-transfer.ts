import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import { Money } from '../../../shared/money.js';
import type { Transaction, TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type {
  CodePolicy,
  CodeVerification,
  OneTimeCodeService,
} from '../../identity/application/one-time-codes.js';
import { effectiveStatus } from '../domain/transfer-status.js';
import { notFound, type ResolvedRoute } from './destination-resolver.js';
import type { LockedTransferExecutor } from './locked-transfer-executor.js';
import type { TransferStore } from './ports.js';
import { balanceOrLimitError, transferExpired, transferNotPending } from './transfer-errors.js';
import { DayChangedWhileWaiting, type TransferLocker } from './transfer-locker.js';
import { toTransferView, type TransferDetailsReader } from './transfer-view.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConfirmTransferDeps {
  readonly transactions: TransactionRunner;
  readonly locker: TransferLocker;
  readonly store: TransferStore;
  readonly codes: OneTimeCodeService;
  readonly otpPolicy: CodePolicy;
  /** Validación y asientos de una transferencia ya bloqueada, compartidos con el ejecutor. */
  readonly executor: LockedTransferExecutor;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly details: TransferDetailsReader;
}

/** Resultado de la transacción: un error de negocio se lanza después del COMMIT. */
type AttemptResult = { readonly kind: 'OK' } | { readonly kind: 'ERROR'; error: DomainError };

/**
 * `POST /transfers/{transferId}/confirm` (TRF-16 a TRF-19, TRF-25, TRF-28). Es idempotente por
 * estado y un código incorrecto, el tercer intento fallido y la revalidación fallida se confirman
 * en la base antes de responder el error, para que el intento y el estado FAILED persistan.
 *
 * Primero lee la transferencia sin bloqueo para elegir el camino: `scheduled_for` nunca cambia, así
 * que esa lectura basta (D5).
 * - **Inmediata:** toma los bloqueos en el orden global (fila contador si es THIRD_PARTY,
 *   transferencia con `FOR UPDATE` y cuentas), revalida saldo y límite y mueve el dinero. Una
 *   COMPLETED responde 200 sin tocar el código. Si la medianoche de CDMX llega mientras espera los
 *   bloqueos, revierte y reintenta una vez (el consumo del código también se revierte).
 * - **Programada:** bloquea solo la transferencia y, con el código correcto, la deja SCHEDULED sin
 *   mover dinero ni revalidar: el saldo y el límite se validan al ejecutarla.
 */
export class ConfirmTransfer {
  constructor(private readonly deps: ConfirmTransferDeps) {}

  async execute(userId: string, transferId: string, code: string): Promise<Transfer> {
    if (!UUID.test(transferId)) throw notFound();
    const id = transferId.toLowerCase();
    const found = await this.deps.details.find(id);
    if (!found || found.userId !== userId || found.kind === 'FUNDING') throw notFound();
    let result: AttemptResult;
    if (found.scheduledFor !== null) {
      result = await this.confirmScheduled(userId, id, code);
    } else {
      const route: ResolvedRoute = {
        kind: found.kind,
        fromAccountId: found.fromAccountId,
        toAccountId: found.toAccountId,
        beneficiaryId: found.beneficiaryId,
      };
      try {
        result = await this.attempt(userId, id, route, code);
      } catch (error) {
        if (!(error instanceof DayChangedWhileWaiting)) throw error;
        result = await this.attempt(userId, id, route, code);
      }
    }
    if (result.kind === 'ERROR') throw result.error;
    const details = await this.deps.details.find(id);
    if (!details) throw new Error('La transferencia confirmada no existe');
    return toTransferView(details, this.deps.clock.now(), this.deps.otpPolicy);
  }

  private attempt(
    userId: string,
    transferId: string,
    route: ResolvedRoute,
    code: string,
  ): Promise<AttemptResult> {
    const { transactions, locker, store, codes, otpPolicy, executor, audit, clock } = this.deps;
    const actor = { type: 'USER' as const, userId };
    const entity = { type: 'transfer', id: transferId };
    return transactions.run(async (tx): Promise<AttemptResult> => {
      const { day, counter: usage } = await locker.lockCounter(tx, userId, route.kind);
      const transfer = await store.lockOwned(tx, transferId, userId);
      if (!transfer) throw notFound();
      if (transfer.status === 'COMPLETED') return { kind: 'OK' };
      const status = effectiveStatus(transfer, clock.now());
      if (status === 'EXPIRED') return { kind: 'ERROR', error: transferExpired() };
      if (status !== 'PENDING_OTP') return { kind: 'ERROR', error: transferNotPending(status) };

      const amount = Money.fromCents(transfer.amountCents);
      const check = await codes.verify(tx, 'TRANSFER_CONFIRMATION', transferId, code, otpPolicy);
      if (check.status !== 'VALID') return this.rejectCode(tx, transferId, actor, amount, check);

      const accounts = await locker.lockAccounts(tx, userId, route, day, usage !== null);
      const execution = await executor.execute(tx, {
        transferId,
        userId,
        kind: route.kind,
        amount,
        locks: { day, counter: usage, ...accounts },
      });
      if (execution.kind === 'DECLINED') {
        const { reason, remaining } = execution;
        await store.fail(tx, transferId, reason);
        await audit.record(tx, {
          action: 'TRANSFER_FAILED',
          actor,
          entity,
          metadata: { reason, amount: amount.toDecimalString() },
        });
        return { kind: 'ERROR', error: balanceOrLimitError(reason, transferId, remaining) };
      }
      await audit.record(tx, {
        action: 'TRANSFER_COMPLETED',
        actor,
        entity,
        metadata: { kind: route.kind, amount: amount.toDecimalString() },
      });
      return { kind: 'OK' };
    });
  }

  /**
   * Programada (TRF-28, D5): bloquea solo la transferencia (`FOR NO KEY UPDATE`), sin contador ni
   * cuentas, porque no mueve dinero; no hace fila detrás de las transferencias del usuario. Ya
   * SCHEDULED (o ya ejecutada) responde 200 sin consumir intentos.
   */
  private confirmScheduled(userId: string, transferId: string, code: string) {
    const { transactions, store, codes, otpPolicy, audit, clock } = this.deps;
    const actor = { type: 'USER' as const, userId };
    return transactions.run(async (tx): Promise<AttemptResult> => {
      const transfer = await store.lockOwnedForStatus(tx, transferId, userId);
      if (!transfer) throw notFound();
      if (transfer.status === 'SCHEDULED' || transfer.status === 'COMPLETED') return { kind: 'OK' };
      const status = effectiveStatus(transfer, clock.now());
      if (status === 'EXPIRED') return { kind: 'ERROR', error: transferExpired() };
      if (status !== 'PENDING_OTP') return { kind: 'ERROR', error: transferNotPending(status) };

      const amount = Money.fromCents(transfer.amountCents);
      const check = await codes.verify(tx, 'TRANSFER_CONFIRMATION', transferId, code, otpPolicy);
      if (check.status !== 'VALID') return this.rejectCode(tx, transferId, actor, amount, check);

      await store.schedule(tx, transferId);
      await audit.record(tx, {
        action: 'TRANSFER_SCHEDULED',
        actor,
        entity: { type: 'transfer', id: transferId },
        metadata: {
          kind: transfer.kind,
          amount: amount.toDecimalString(),
          scheduledFor: transfer.scheduledFor?.toISOString() ?? null,
        },
      });
      return { kind: 'OK' };
    });
  }

  /**
   * Código que no sirve (TRF-17, TRF-19): un intento fallido se audita y responde `OTP_INVALID`; el
   * tercero deja la transferencia FAILED con `OTP_ATTEMPTS_EXHAUSTED`. Un código vencido es
   * `TRANSFER_EXPIRED`. Una PENDING_OTP siempre tiene un código usable: si no, el estado es
   * inconsistente y se lanza.
   */
  private async rejectCode(
    tx: Transaction,
    transferId: string,
    actor: { readonly type: 'USER'; readonly userId: string },
    amount: Money,
    check: Exclude<CodeVerification, { readonly status: 'VALID' }>,
  ): Promise<AttemptResult> {
    const { store, audit } = this.deps;
    const entity = { type: 'transfer', id: transferId };
    if (check.status === 'EXPIRED') return { kind: 'ERROR', error: transferExpired() };
    if (check.status !== 'INVALID') {
      throw new Error('La transferencia pendiente no tiene un código usable');
    }
    await audit.record(tx, {
      action: check.exhausted ? 'OTP_ATTEMPTS_EXHAUSTED' : 'OTP_ATTEMPT_FAILED',
      actor,
      entity,
      metadata: {
        purpose: 'TRANSFER_CONFIRMATION',
        attemptsRemaining: check.attemptsRemaining,
      },
    });
    if (!check.exhausted) {
      return {
        kind: 'ERROR',
        error: new DomainError('OTP_INVALID', 'El código de confirmación es incorrecto', {
          attemptsRemaining: check.attemptsRemaining,
        }),
      };
    }
    await store.fail(tx, transferId, 'OTP_ATTEMPTS_EXHAUSTED');
    await audit.record(tx, {
      action: 'TRANSFER_FAILED',
      actor,
      entity,
      metadata: { reason: 'OTP_ATTEMPTS_EXHAUSTED', amount: amount.toDecimalString() },
    });
    return {
      kind: 'ERROR',
      error: new DomainError(
        'OTP_ATTEMPTS_EXHAUSTED',
        'Se agotaron los intentos del código; la transferencia se canceló',
        { transferId },
      ),
    };
  }
}
