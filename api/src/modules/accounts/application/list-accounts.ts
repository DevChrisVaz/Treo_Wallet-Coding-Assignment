import type { AccountsOverview } from '@devchrisvaz/wallet-contract';
import {
  BUSINESS_TIME_ZONE,
  businessDayOf,
  nextBusinessDayStart,
} from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';
import { Money } from '../../../shared/money.js';
import { toAccountView } from './account-view.js';
import type { AccountRepository } from './accounts.js';
import type { DailyUsageReader } from './daily-usage.js';

export interface ListAccountsDeps {
  readonly accounts: AccountRepository;
  readonly usage: DailyUsageReader;
  readonly dailyLimit: Money;
  readonly clock: Clock;
}

/**
 * `GET /accounts` (ACC-10, ACC-13): las cuentas USER del usuario con su saldo disponible, que es el
 * saldo contable (sin retenciones), y el estado del límite diario (ACC-11): lo usado hoy en
 * transferencias a terceros según la fila contador del día de CDMX (0 si no existe), lo que queda
 * y la siguiente medianoche de CDMX en UTC.
 */
export class ListAccounts {
  constructor(private readonly deps: ListAccountsDeps) {}

  async execute(userId: string): Promise<AccountsOverview> {
    const accounts = await this.deps.accounts.listOwnedBy(userId);
    const now = this.deps.clock.now();
    const today = await this.deps.usage.usage(userId, businessDayOf(now));
    const used = today?.used ?? Money.ZERO;
    const limit = today?.limit ?? this.deps.dailyLimit;
    const remaining = limit.minus(used);
    return {
      accounts: accounts.map(toAccountView),
      dailyLimit: {
        limit: limit.toDecimalString(),
        used: used.toDecimalString(),
        remaining: (remaining.isLessThan(Money.ZERO) ? Money.ZERO : remaining).toDecimalString(),
        resetsAt: nextBusinessDayStart(now).toISOString(),
        timeZone: BUSINESS_TIME_ZONE,
      },
    };
  }
}
