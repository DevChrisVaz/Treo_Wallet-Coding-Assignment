import type { DataSource } from 'typeorm';
import { queryIn, queryRunnerOf } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { AccountRepository } from '../application/accounts.js';
import type { UserAccount } from '../domain/account.js';
import { AccountEntity, type AccountRow } from './entities.js';

function toUserAccount(row: AccountRow): UserAccount {
  return {
    id: row.id,
    userId: row.userId as string,
    name: row.name,
    clabe: row.clabe as string,
    balanceCents: row.balanceCents,
    createdAt: row.createdAt,
  };
}

/** Cuentas en PostgreSQL. Las consultas en nombre de un usuario filtran por dueño y tipo USER. */
export class PgAccountRepository implements AccountRepository {
  constructor(private readonly dataSource: DataSource) {}

  async nextAccountNumber(tx: Transaction): Promise<bigint> {
    const [row] = await queryIn<{ n: string }>(tx, `SELECT nextval('seq_account_number') AS n`);
    return BigInt(row?.n ?? '0');
  }

  async insertUserAccount(tx: Transaction, account: UserAccount): Promise<void> {
    await queryRunnerOf(tx).manager.insert(AccountEntity, { ...account, type: 'USER' });
  }

  async listOwnedBy(userId: string): Promise<UserAccount[]> {
    const rows = await this.dataSource.getRepository(AccountEntity).find({
      where: { userId, type: 'USER' },
      // Las dos cuentas se abren en el mismo instante: "Principal" antes que "Ahorro".
      order: { createdAt: 'ASC', name: 'DESC' },
    });
    return rows.map(toUserAccount);
  }

  async findOwnedBy(userId: string, accountId: string): Promise<UserAccount | null> {
    const row = await this.dataSource
      .getRepository(AccountEntity)
      .findOneBy({ id: accountId, userId, type: 'USER' });
    return row ? toUserAccount(row) : null;
  }
}
