import type { Transfer } from '@devchrisvaz/wallet-contract';
import type { Clock } from '../../../shared/clock.js';
import { Money } from '../../../shared/money.js';
import type { TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import { effectiveStatus } from '../domain/transfer-status.js';
import { notFound } from './destination-resolver.js';
import type { TransferStore } from './ports.js';
import { transferNotCancellable } from './transfer-errors.js';
import { toTransferView, type OtpPolicy, type TransferDetailsReader } from './transfer-view.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CancelTransferDeps {
  readonly transactions: TransactionRunner;
  readonly store: TransferStore;
  readonly audit: AuditWriter;
  readonly clock: Clock;
  readonly details: TransferDetailsReader;
  readonly otpPolicy: OtpPolicy;
}

/**
 * `POST /transfers/{transferId}/cancel` (TRF-32, TRF-36, AUD-08; D7). Bloquea solo la
 * transferencia del usuario (`FOR NO KEY UPDATE`, con el dueño en la misma sentencia), así que no
 * puede formar un ciclo de espera: si el ejecutor la tiene, espera y después la ve COMPLETED o
 * FAILED (409); si la tiene la cancelación, el ejecutor la salta con `SKIP LOCKED` y en la siguiente
 * pasada ya no está SCHEDULED. Una SCHEDULED pasa a CANCELLED con `cancelledAt` y
 * `TRANSFER_CANCELLED`; una ya CANCELLED responde 200 sin cambios ni evento; cualquier otro estado,
 * incluido EXPIRED calculado, es 409 `TRANSFER_NOT_CANCELLABLE`. Ajena, de fondeo o inexistente:
 * 404.
 */
export class CancelTransfer {
  constructor(private readonly deps: CancelTransferDeps) {}

  async execute(userId: string, transferId: string): Promise<Transfer> {
    if (!UUID.test(transferId)) throw notFound();
    const id = transferId.toLowerCase();
    const { transactions, store, audit, clock, details, otpPolicy } = this.deps;
    await transactions.run(async (tx) => {
      const transfer = await store.lockOwnedForStatus(tx, id, userId);
      if (!transfer) throw notFound();
      if (transfer.status === 'CANCELLED') return;
      if (transfer.status !== 'SCHEDULED') {
        throw transferNotCancellable(effectiveStatus(transfer, clock.now()));
      }
      await store.cancel(tx, id, clock.now());
      await audit.record(tx, {
        action: 'TRANSFER_CANCELLED',
        actor: { type: 'USER', userId },
        entity: { type: 'transfer', id },
        metadata: {
          amount: Money.fromCents(transfer.amountCents).toDecimalString(),
          scheduledFor: transfer.scheduledFor?.toISOString() ?? null,
        },
      });
    });
    const found = await details.find(id);
    if (!found) throw new Error('La transferencia cancelada no existe');
    return toTransferView(found, clock.now(), otpPolicy);
  }
}
