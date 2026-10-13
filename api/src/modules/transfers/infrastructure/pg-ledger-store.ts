import { queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { LedgerEntryRow, LedgerStore } from '../application/ledger-poster.js';

/** Ledger en PostgreSQL: los dos asientos van en una sola sentencia. */
export class PgLedgerStore implements LedgerStore {
  async insertEntries(tx: Transaction, entries: readonly LedgerEntryRow[]): Promise<void> {
    const values: unknown[] = [];
    const rows = entries.map((entry, index) => {
      const base = index * 6;
      values.push(
        entry.transferId,
        entry.accountId,
        entry.type,
        entry.amountCents.toString(),
        entry.balanceAfterCents.toString(),
        entry.createdAt,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });
    await queryIn(
      tx,
      `INSERT INTO ledger_entries (transfer_id, account_id, type, amount_cents, balance_after_cents,
                                   created_at)
       VALUES ${rows.join(', ')}`,
      values,
    );
  }

  async setBalance(tx: Transaction, accountId: string, balanceCents: bigint): Promise<void> {
    await queryIn(tx, `UPDATE accounts SET balance_cents = $2 WHERE id = $1`, [
      accountId,
      balanceCents.toString(),
    ]);
  }

  async markCompleted(tx: Transaction, transferId: string, completedAt: Date): Promise<void> {
    await queryIn(
      tx,
      `UPDATE transfers SET status = 'COMPLETED', completed_at = $2, otp_expires_at = NULL
        WHERE id = $1`,
      [transferId, completedAt],
    );
  }
}
