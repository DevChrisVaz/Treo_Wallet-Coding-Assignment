import type { Money } from '../../../shared/money.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { TransferKind } from '../domain/ledger.js';
import { declineFor, type Decline } from '../domain/settlement.js';
import type { LedgerPoster } from './ledger-poster.js';
import type { AcquiredLocks, DailyUsageCounter } from './transfer-locker.js';

export type Execution = { readonly kind: 'POSTED' } | ({ readonly kind: 'DECLINED' } & Decline);

/**
 * Ejecuta una transferencia cuyos bloqueos ya se tomaron en el orden global (D6): valida saldo y
 * límite bajo bloqueo con la regla del dominio y, si pasan, asienta (dos asientos, saldos y
 * COMPLETED con la hora tomada después de los bloqueos) y consume el límite del día del contador.
 * Lo usan la creación inmediata, la confirmación y el ejecutor de programadas, para que los tres
 * caminos no diverjan. No audita ni decide el estado de un rechazo: eso depende de quién llama.
 */
export class LockedTransferExecutor {
  constructor(
    private readonly poster: LedgerPoster,
    private readonly counter: DailyUsageCounter,
  ) {}

  async execute(
    tx: Transaction,
    input: {
      readonly transferId: string;
      readonly userId: string;
      readonly kind: Exclude<TransferKind, 'FUNDING'>;
      readonly amount: Money;
      readonly locks: AcquiredLocks;
    },
  ): Promise<Execution> {
    const { locks } = input;
    const decline = declineFor({
      balance: locks.from.balance,
      amount: input.amount,
      usage: locks.counter,
    });
    if (decline) return { kind: 'DECLINED', ...decline };
    await this.poster.post(tx, {
      transferId: input.transferId,
      kind: input.kind,
      from: locks.from,
      to: locks.to,
      amount: input.amount,
      at: locks.at,
    });
    if (locks.counter) await this.counter.add(tx, input.userId, locks.day, input.amount);
    return { kind: 'POSTED' };
  }
}
