import { businessDayOf } from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';
import type { AppLogger } from '../../../shared/logger.js';
import { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { ResolvedRoute } from './destination-resolver.js';
import type { LockedTransferExecutor } from './locked-transfer-executor.js';
import type { DueTransfer, RejectionReason, ScheduledQueue, TransferStore } from './ports.js';
import type { ScheduledFailureNotifier } from './transfer-emails.js';
import { DayChangedWhileWaiting, type TransferLocker } from './transfer-locker.js';

export interface ScheduledTransferRunnerDeps {
  readonly transactions: TransactionRunner;
  readonly queue: ScheduledQueue;
  readonly locker: TransferLocker;
  readonly executor: LockedTransferExecutor;
  readonly store: TransferStore;
  readonly audit: AuditWriter;
  /** Aviso al dueño de una programada que quedó FAILED, después del COMMIT (TRF-35). */
  readonly notifier: ScheduledFailureNotifier;
  readonly clock: Clock;
  readonly logger: AppLogger;
  /** Candidatas por lote (D6: 100). */
  readonly batchSize: number;
}

/** Lo que pasó con una candidata. `SKIPPED`: otra instancia la tenía o ya no estaba SCHEDULED. */
export type Outcome =
  | { readonly kind: 'COMPLETED' }
  | { readonly kind: 'FAILED'; readonly reason: RejectionReason }
  | { readonly kind: 'SKIPPED' };

export interface PassSummary {
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
  /** Candidatas cuya transacción se revirtió por un error: siguen SCHEDULED para otra pasada. */
  readonly errors: number;
}

/**
 * Ejecutor de transferencias programadas (TRF-30, TRF-31, TRF-36, D6). `runOnce()` es una pasada:
 * lee sin bloqueo las SCHEDULED vencidas al día de CDMX de hoy, en lotes y en orden de ejecución,
 * y ejecuta cada una en su propia transacción con el orden global de bloqueos:
 * 1. fila contador del usuario y del día de ahora (solo THIRD_PARTY);
 * 2. la transferencia con `FOR NO KEY UPDATE SKIP LOCKED`, solo si sigue SCHEDULED: si otra
 *    instancia o una cancelación la tiene, o ya cambió de estado, se deja y se sigue;
 * 3. las cuentas en orden de id;
 * 4. hora después de los bloqueos: si ya es otro día de CDMX, revierte y reintenta una vez (el
 *    mismo mecanismo que una inmediata).
 * Después valida y asienta con el mismo servicio que la creación, y la deja COMPLETED o FAILED con
 * su motivo, auditada con actor SYSTEM y el dueño en los metadatos. No hay OTP: se confirmó al
 * programar. Varias instancias pueden correr pasadas a la vez: `SKIP LOCKED` reparte el trabajo y
 * el filtro de estado bajo bloqueo impide ejecutar dos veces.
 *
 * Los errores quedan aislados por transferencia (TRF-36): si algo lanza (por ejemplo la auditoría),
 * se revierte solo esa transacción, se registra un ERROR con su id y la pasada sigue; la
 * transferencia queda SCHEDULED y se reintenta en la siguiente pasada (no en la misma: el lote
 * siguiente empieza después de ella).
 */
export class ScheduledTransferRunner {
  constructor(private readonly deps: ScheduledTransferRunnerDeps) {}

  async runOnce(): Promise<PassSummary> {
    const { queue, clock, batchSize, logger } = this.deps;
    const today = businessDayOf(clock.now());
    const summary = { completed: 0, failed: 0, skipped: 0, errors: 0 };
    let after: string | null = null;
    for (;;) {
      const batch = await queue.due(today, batchSize, after);
      for (const candidate of batch) {
        try {
          const outcome = await this.execute(candidate);
          if (outcome.kind === 'COMPLETED') summary.completed += 1;
          else if (outcome.kind === 'FAILED') summary.failed += 1;
          else summary.skipped += 1;
        } catch (error) {
          summary.errors += 1;
          logger.error(
            { transferId: candidate.id, err: error },
            'scheduled transfer execution failed',
          );
        }
      }
      // Lote lleno: puede haber más vencidas; el siguiente empieza después de la última.
      const last = batch.at(-1);
      if (batch.length < batchSize || !last) break;
      after = last.id;
    }
    if (summary.completed + summary.failed + summary.skipped + summary.errors > 0) {
      logger.info({ day: today, ...summary }, 'scheduled transfers pass');
    }
    return summary;
  }

  private async execute(candidate: DueTransfer): Promise<Outcome> {
    let outcome: Outcome;
    try {
      outcome = await this.attempt(candidate);
    } catch (error) {
      if (!(error instanceof DayChangedWhileWaiting)) throw error;
      outcome = await this.attempt(candidate);
    }
    // Después del COMMIT: el aviso nunca revierte ni repite la ejecución (TRF-35, D10).
    if (outcome.kind === 'FAILED') await this.notifyFailure(candidate.id, outcome.reason);
    return outcome;
  }

  private async notifyFailure(transferId: string, reason: RejectionReason): Promise<void> {
    try {
      await this.deps.notifier.notify(transferId, reason);
    } catch (error) {
      this.deps.logger.warn({ transferId, err: error }, 'scheduled transfer failure notice failed');
    }
  }

  private attempt(candidate: DueTransfer): Promise<Outcome> {
    const { transactions, queue, locker, executor, store, audit } = this.deps;
    return transactions.run(async (tx): Promise<Outcome> => {
      const { day, counter } = await locker.lockCounter(tx, candidate.userId, candidate.kind);
      const transfer = await queue.lockDue(tx, candidate.id);
      if (!transfer || !transfer.userId || transfer.scheduledFor === null) {
        return { kind: 'SKIPPED' };
      }
      const route: ResolvedRoute = {
        kind: candidate.kind,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        beneficiaryId: transfer.beneficiaryId,
      };
      const accounts = await locker.lockAccounts(tx, transfer.userId, route, day, counter !== null);
      const amount = Money.fromCents(transfer.amountCents);
      const execution = await executor.execute(tx, {
        transferId: transfer.id,
        userId: transfer.userId,
        kind: candidate.kind,
        amount,
        locks: { day, counter, ...accounts },
      });
      // Actor SYSTEM sin id de actor; el dueño va en los metadatos (AUD-08).
      const actor = { type: 'SYSTEM' as const };
      const entity = { type: 'transfer', id: transfer.id };
      const facts = {
        userId: transfer.userId,
        amount: amount.toDecimalString(),
        scheduledFor: transfer.scheduledFor,
      };
      if (execution.kind === 'DECLINED') {
        await store.fail(tx, transfer.id, execution.reason);
        await audit.record(tx, {
          action: 'TRANSFER_FAILED',
          actor,
          entity,
          metadata: { ...facts, reason: execution.reason },
        });
        return { kind: 'FAILED', reason: execution.reason };
      }
      await audit.record(tx, {
        action: 'TRANSFER_COMPLETED',
        actor,
        entity,
        metadata: { ...facts, kind: candidate.kind },
      });
      return { kind: 'COMPLETED' };
    });
  }
}
