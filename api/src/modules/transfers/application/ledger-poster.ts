import type { Money } from '../../../shared/money.js';
import type { Transaction } from '../../../shared/transaction.js';
import {
  movementTypes,
  type LockedAccount,
  type MovementType,
  type TransferKind,
} from '../domain/ledger.js';

export interface LedgerEntryRow {
  readonly transferId: string;
  readonly accountId: string;
  readonly type: MovementType;
  readonly amountCents: bigint;
  readonly balanceAfterCents: bigint;
  readonly createdAt: Date;
}

/** Escritura del ledger: asientos (solo inserción), saldos y estado de la transferencia. */
export interface LedgerStore {
  insertEntries(tx: Transaction, entries: readonly LedgerEntryRow[]): Promise<void>;
  setBalance(tx: Transaction, accountId: string, balanceCents: bigint): Promise<void>;
  markCompleted(tx: Transaction, transferId: string, completedAt: Date): Promise<void>;
}

export interface Posting {
  readonly transferId: string;
  readonly kind: TransferKind;
  /** Ambas cuentas deben estar bloqueadas por quien llama, en orden de id. */
  readonly from: LockedAccount;
  readonly to: LockedAccount;
  readonly amount: Money;
  /** Hora tomada después de obtener los bloqueos: es `completed_at` y la fecha de los asientos. */
  readonly at: Date;
}

export interface PostingResult {
  readonly fromBalanceAfter: Money;
  readonly toBalanceAfter: Money;
}

/**
 * Asienta una transferencia (TRF-21, TRF-22): dos asientos que suman cero, con su tipo y el saldo
 * resultante calculado desde el saldo leído bajo bloqueo; actualiza ambos saldos y marca la
 * transferencia como COMPLETED, todo en la transacción de quien llama. Los triggers diferidos de la
 * base vuelven a verificar la partida doble al COMMIT.
 */
export class LedgerPoster {
  constructor(private readonly store: LedgerStore) {}

  async post(tx: Transaction, posting: Posting): Promise<PostingResult> {
    const types = movementTypes(posting.kind);
    const fromBalanceAfter = posting.from.balance.minus(posting.amount);
    const toBalanceAfter = posting.to.balance.plus(posting.amount);
    await this.store.insertEntries(tx, [
      {
        transferId: posting.transferId,
        accountId: posting.from.id,
        type: types.out,
        amountCents: -posting.amount.cents,
        balanceAfterCents: fromBalanceAfter.cents,
        createdAt: posting.at,
      },
      {
        transferId: posting.transferId,
        accountId: posting.to.id,
        type: types.in,
        amountCents: posting.amount.cents,
        balanceAfterCents: toBalanceAfter.cents,
        createdAt: posting.at,
      },
    ]);
    await this.store.setBalance(tx, posting.from.id, fromBalanceAfter.cents);
    await this.store.setBalance(tx, posting.to.id, toBalanceAfter.cents);
    await this.store.markCompleted(tx, posting.transferId, posting.at);
    return { fromBalanceAfter, toBalanceAfter };
  }
}
