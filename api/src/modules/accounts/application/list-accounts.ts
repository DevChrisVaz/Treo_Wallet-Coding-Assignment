import type { AccountsOverview } from '@devchrisvaz/wallet-contract';
import { BUSINESS_TIME_ZONE, nextBusinessDayStart } from '../../../shared/business-day.js';
import type { Clock } from '../../../shared/clock.js';
import { Money } from '../../../shared/money.js';
import { toAccountView } from './account-view.js';
import type { AccountRepository } from './accounts.js';

export interface ListAccountsDeps {
  readonly accounts: AccountRepository;
  readonly dailyLimit: Money;
  readonly clock: Clock;
}

/**
 * `GET /accounts` (ACC-10, ACC-13): las cuentas USER del usuario con su saldo disponible, que es el
 * saldo contable (sin retenciones), y el estado del límite diario.
 */
export class ListAccounts {
  constructor(private readonly deps: ListAccountsDeps) {}

  async execute(userId: string): Promise<AccountsOverview> {
    const accounts = await this.deps.accounts.listOwnedBy(userId);
    const now = this.deps.clock.now();
    const used = Money.ZERO;
    return {
      accounts: accounts.map(toAccountView),
      dailyLimit: {
        limit: this.deps.dailyLimit.toDecimalString(),
        used: used.toDecimalString(),
        remaining: this.deps.dailyLimit.minus(used).toDecimalString(),
        resetsAt: nextBusinessDayStart(now).toISOString(),
        timeZone: BUSINESS_TIME_ZONE,
      },
    };
  }
}
