import type { DataSource } from 'typeorm';
import type { DailyUsageReader } from '../../accounts/application/daily-usage.js';
import { Money } from '../../../shared/money.js';

/** Fila contador del límite diario (`daily_transfer_usage`), por usuario y día de CDMX. */
export class PgDailyUsage implements DailyUsageReader {
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
}
