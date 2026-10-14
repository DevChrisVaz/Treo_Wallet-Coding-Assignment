import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { CodePolicy, OneTimeCodeService } from '../../identity/application/one-time-codes.js';
import { effectiveStatus } from '../domain/transfer-status.js';
import { notFound, type ResolvedRoute } from './destination-resolver.js';
import type { LedgerPoster } from './ledger-poster.js';
import type { RejectionReason, TransferStore } from './ports.js';
import { balanceOrLimitError, transferExpired, transferNotPending } from './transfer-errors.js';
import {
  DayChangedWhileWaiting,
  type DailyUsageCounter,
  type TransferLocker,
} from './transfer-locker.js';
import { toTransferView, type TransferDetailsReader } from './transfer-view.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConfirmTransferDeps {
  readonly transactions: TransactionRunner;
  readonly locker: TransferLocker;
  readonly store: TransferStore;
  readonly codes: OneTimeCodeService;
  readonly otpPolicy: CodePolicy;
  readonly poster: LedgerPoster;
  readonly counter: DailyUsageCounter;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly details: TransferDetailsReader;
}

/** Resultado de la transacción: un error de negocio se lanza después del COMMIT. */
type AttemptResult =
  { readonly kind: 'COMPLETED' } | { readonly kind: 'ERROR'; error: DomainError };

/**
 * `POST /transfers/{transferId}/confirm` (TRF-16 a TRF-19, TRF-25). Toma los bloqueos en el orden
 * global: fila contador (THIRD_PARTY), transferencia (`FOR UPDATE`) y cuentas. Es idempotente por
 * estado: una COMPLETED responde 200 sin tocar el código. Un código incorrecto, el tercer intento
 * fallido y la revalidación fallida se confirman en la base antes de responder el error, para que
 * el intento y el estado FAILED persistan. Si la medianoche de CDMX llega mientras espera los
 * bloqueos, revierte y reintenta una vez (el consumo del código también se revierte).
 */
export class ConfirmTransfer {
  constructor(private readonly deps: ConfirmTransferDeps) {}

  async execute(userId: string, transferId: string, code: string): Promise<Transfer> {
    if (!UUID.test(transferId)) throw notFound();
    const id = transferId.toLowerCase();
    const found = await this.deps.details.find(id);
    if (!found || found.userId !== userId || found.kind === 'FUNDING') throw notFound();
    const route: ResolvedRoute = {
      kind: found.kind,
      fromAccountId: found.fromAccountId,
      toAccountId: found.toAccountId,
      beneficiaryId: found.beneficiaryId,
    };
    let result: AttemptResult;
    try {
      result = await this.attempt(userId, id, route, code);
    } catch (error) {
      if (!(error instanceof DayChangedWhileWaiting)) throw error;
      result = await this.attempt(userId, id, route, code);
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
    const { transactions, locker, store, codes, otpPolicy, poster, counter, audit, clock } =
      this.deps;
    const actor = { type: 'USER' as const, userId };
    const entity = { type: 'transfer', id: transferId };
    return transactions.run(async (tx): Promise<AttemptResult> => {
      const { day, counter: usage } = await locker.lockCounter(tx, userId, route.kind);
      const transfer = await store.lockOwned(tx, transferId, userId);
      if (!transfer) throw notFound();
      if (transfer.status === 'COMPLETED') return { kind: 'COMPLETED' };
      const status = effectiveStatus(transfer, clock.now());
      if (status === 'EXPIRED') return { kind: 'ERROR', error: transferExpired() };
      if (status !== 'PENDING_OTP') return { kind: 'ERROR', error: transferNotPending(status) };

      const amount = Money.fromCents(transfer.amountCents);
      const check = await codes.verify(tx, 'TRANSFER_CONFIRMATION', transferId, code, otpPolicy);
      if (check.status === 'EXPIRED') return { kind: 'ERROR', error: transferExpired() };
      if (check.status === 'UNUSABLE') {
        // Una PENDING_OTP siempre tiene un código usable: si no, el estado es inconsistente.
        throw new Error('La transferencia pendiente no tiene un código usable');
      }
      if (check.status === 'INVALID') {
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

      const locks = await locker.lockAccounts(tx, userId, route, day, usage !== null);
      let reason: RejectionReason | null = null;
      let remaining: Money | null = null;
      if (locks.from.balance.isLessThan(amount)) reason = 'INSUFFICIENT_FUNDS';
      else if (usage && usage.used.plus(amount).isGreaterThan(usage.limit)) {
        reason = 'DAILY_LIMIT_EXCEEDED';
        remaining = usage.limit.minus(usage.used);
      }
      if (reason) {
        await store.fail(tx, transferId, reason);
        await audit.record(tx, {
          action: 'TRANSFER_FAILED',
          actor,
          entity,
          metadata: { reason, amount: amount.toDecimalString() },
        });
        return { kind: 'ERROR', error: balanceOrLimitError(reason, transferId, remaining) };
      }
      await poster.post(tx, {
        transferId,
        kind: route.kind,
        from: locks.from,
        to: locks.to,
        amount,
        at: locks.at,
      });
      if (usage) await counter.add(tx, userId, day, amount);
      await audit.record(tx, {
        action: 'TRANSFER_COMPLETED',
        actor,
        entity,
        metadata: { kind: route.kind, amount: amount.toDecimalString() },
      });
      return { kind: 'COMPLETED' };
    });
  }
}
