import type { DataSource } from 'typeorm';
import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import { Money } from '../../../shared/money.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { AccountLocks } from '../application/ports.js';
import type { LockedAccount } from '../domain/ledger.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
  id: string;
  user_id: string | null;
  type: 'USER' | 'SYSTEM';
  balance_cents: string;
}

/**
 * Bloqueo de cuentas para mover dinero. `FOR NO KEY UPDATE` y no `FOR UPDATE`: insertar
 * transferencias y asientos toma `FOR KEY SHARE` sobre las cuentas por sus llaves foráneas, que no
 * choca con `NO KEY UPDATE` pero sí con `UPDATE` (deadlock). Siempre en orden de id.
 */
export class PgAccountLocks implements AccountLocks {
  constructor(private readonly dataSource: DataSource) {}

  async treasuryId(tx: Transaction): Promise<string> {
    const [row] = await queryIn<{ id: string }>(
      tx,
      `SELECT id FROM accounts WHERE type = 'SYSTEM'`,
    );
    if (!row) throw new Error('No existe la cuenta SYSTEM (Tesorería)');
    return row.id;
  }

  async findUserAccount(idOrClabe: string): Promise<string | null> {
    const byId = UUID.test(idOrClabe);
    if (!byId && !/^[0-9]{18}$/.test(idOrClabe)) return null;
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM accounts WHERE type = 'USER' AND ${byId ? 'id' : 'clabe'} = $1`,
      [idOrClabe],
    );
    return rows[0]?.id ?? null;
  }

  async lock(
    tx: Transaction,
    ids: readonly string[],
    options: { readonly ownedBy?: string; readonly ownedIds?: readonly string[] } = {},
  ): Promise<LockedAccount[]> {
    const params: unknown[] = [[...ids]];
    let ownership = '';
    if (options.ownedBy) {
      // Las cuentas en `ownedIds` deben ser USER del usuario; las demás solo deben ser USER.
      params.push(options.ownedBy, [...(options.ownedIds ?? ids)]);
      ownership = `AND type = 'USER' AND (id <> ALL($3) OR user_id = $2)`;
    }
    const rows = await queryForUpdate<Row>(
      tx,
      `SELECT id, user_id, type, balance_cents FROM accounts
        WHERE id = ANY($1) ${ownership}
        ORDER BY id FOR NO KEY UPDATE`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      balance: Money.fromCents(BigInt(row.balance_cents)),
    }));
  }
}
