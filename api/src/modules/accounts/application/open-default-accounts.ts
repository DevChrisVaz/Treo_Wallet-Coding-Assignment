import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import type { Transaction } from '../../../shared/transaction.js';
import { DEFAULT_ACCOUNT_NAMES, type UserAccount } from '../domain/account.js';
import { buildClabe } from '../domain/clabe.js';
import type { AccountRepository } from './accounts.js';

export interface OpenDefaultAccountsDeps {
  readonly accounts: AccountRepository;
  /** Banco y plaza de la configuración (ACC-03). */
  readonly clabe: { readonly bankCode: string; readonly plazaCode: string };
  readonly clock: Clock;
}

/**
 * Abre "Principal" y "Ahorro" con saldo 0 y CLABE generada (ACC-03, ACC-04). Es un paso dentro de
 * la transacción de quien llama (la verificación del correo): si ésta se revierte, no quedan
 * cuentas. `uq_accounts_user_name` impide que una repetición abra cuentas adicionales.
 */
export class OpenDefaultAccounts {
  constructor(private readonly deps: OpenDefaultAccountsDeps) {}

  async execute(tx: Transaction, userId: string): Promise<UserAccount[]> {
    const opened: UserAccount[] = [];
    for (const name of DEFAULT_ACCOUNT_NAMES) {
      const accountNumber = await this.deps.accounts.nextAccountNumber(tx);
      const account: UserAccount = {
        id: randomUUID(),
        userId,
        name,
        clabe: buildClabe({ ...this.deps.clabe, accountNumber }),
        balanceCents: 0n,
        createdAt: this.deps.clock.now(),
      };
      await this.deps.accounts.insertUserAccount(tx, account);
      opened.push(account);
    }
    return opened;
  }
}
