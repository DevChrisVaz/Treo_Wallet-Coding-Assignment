import type { DataSource } from 'typeorm';
import { queryForUpdate, queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { DailyUsageCounter } from '../application/transfer-locker.js';
import type { DailyUsageReader } from '../../accounts/application/daily-usage.js';
import { Money } from '../../../shared/money.js';

/** Fila contador del límite diario (`daily_transfer_usage`), por usuario y día de CDMX. */
export class PgDailyUsage implements DailyUsageReader, DailyUsageCounter {
  constructor(private readonly dataSource: DataSource) {}

  async usage(userId: string, day: string): Promise<{ used: Money; limit: Money } | null> {
    const rows: { used_cents: string; limit_cents: string }[] = await this.dataSource.query(
      `SELECT used_cents, limit_cents FROM daily_transfer_usage WHERE user_id = $1 AND day = $2::date`,
      [userId, day],
    );
    const [row] = rows;
    if (!row) return null;
    return {
      used: Money.fromCents(BigInt(row.used_cents)),
      limit: Money.fromCents(BigInt(row.limit_cents)),
    };
  }

  async lock(tx: Transaction, userId: string, day: string, limit: Money) {
    await queryIn(
      tx,
      `INSERT INTO daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, $2::date, 0, $3)
       ON CONFLICT ON CONSTRAINT pk_daily_transfer_usage DO NOTHING`,
      [userId, day, limit.cents.toString()],
    );
    const [row] = await queryForUpdate<{ used_cents: string; limit_cents: string }>(
      tx,
      `SELECT used_cents, limit_cents FROM daily_transfer_usage
        WHERE user_id = $1 AND day = $2::date FOR UPDATE`,
      [userId, day],
    );
    if (!row) throw new Error('No se pudo bloquear la fila contador del límite diario');
    return {
      used: Money.fromCents(BigInt(row.used_cents)),
      limit: Money.fromCents(BigInt(row.limit_cents)),
    };
  }

  async add(tx: Transaction, userId: string, day: string, amount: Money): Promise<void> {
    await queryIn(
      tx,
      `UPDATE daily_transfer_usage SET used_cents = used_cents + $3
        WHERE user_id = $1 AND day = $2::date`,
      [userId, day, amount.cents.toString()],
    );
  }
}
