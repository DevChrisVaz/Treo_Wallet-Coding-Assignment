import type { DataSource } from 'typeorm';
import { queryIn, queryRunnerOf } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { AccountRepository } from '../application/accounts.js';
import type { UserAccount } from '../domain/account.js';
import { AccountEntity } from './entities.js';

/** Cuentas en PostgreSQL. Las consultas en nombre de un usuario filtran por dueño y tipo USER. */
export class PgAccountRepository implements AccountRepository {
  constructor(protected readonly dataSource: DataSource) {}

  async nextAccountNumber(tx: Transaction): Promise<bigint> {
    const [row] = await queryIn<{ n: string }>(tx, `SELECT nextval('seq_account_number') AS n`);
    return BigInt(row?.n ?? '0');
  }

  async insertUserAccount(tx: Transaction, account: UserAccount): Promise<void> {
    await queryRunnerOf(tx).manager.insert(AccountEntity, { ...account, type: 'USER' });
  }
}
