import type { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../../platform/persistence/pg-errors.js';
import { queryIn } from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { PlatformAccountDirectory } from '../application/clabe-resolver.js';
import {
  BeneficiaryDuplicate,
  type BeneficiaryRecord,
  type BeneficiaryStore,
} from '../application/create-beneficiary.js';

interface Row {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  alias: string;
  clabe: string;
  created_at: Date;
}

const COLUMNS = 'id, user_id, account_id, name, alias, clabe, created_at';

function fromRow(row: Row): BeneficiaryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    name: row.name,
    alias: row.alias,
    clabe: row.clabe,
    createdAt: row.created_at,
  };
}

/** Beneficiarios en PostgreSQL, siempre filtrados por su dueño. */
export class PgBeneficiaryStore implements BeneficiaryStore, PlatformAccountDirectory {
  constructor(private readonly dataSource: DataSource) {}

  async findByClabe(tx: Transaction, userId: string, clabe: string) {
    const [row] = await queryIn<Row>(
      tx,
      `SELECT ${COLUMNS} FROM beneficiaries WHERE user_id = $1 AND clabe = $2`,
      [userId, clabe],
    );
    return row ? fromRow(row) : null;
  }

  async findByAlias(tx: Transaction, userId: string, alias: string) {
    const [row] = await queryIn<Row>(
      tx,
      `SELECT ${COLUMNS} FROM beneficiaries WHERE user_id = $1 AND alias = $2`,
      [userId, alias],
    );
    return row ? fromRow(row) : null;
  }

  async insert(tx: Transaction, row: BeneficiaryRecord): Promise<void> {
    try {
      await queryIn(
        tx,
        `INSERT INTO beneficiaries (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, row.userId, row.accountId, row.name, row.alias, row.clabe, row.createdAt],
      );
    } catch (error) {
      if (
        isUniqueViolation(error, ['uq_beneficiaries_user_clabe', 'uq_beneficiaries_user_alias'])
      ) {
        throw new BeneficiaryDuplicate();
      }
      throw error;
    }
  }

  async listByUser(userId: string): Promise<BeneficiaryRecord[]> {
    const rows: Row[] = await this.dataSource.query(
      `SELECT ${COLUMNS} FROM beneficiaries WHERE user_id = $1 ORDER BY alias, id`,
      [userId],
    );
    return rows.map(fromRow);
  }

  async findUserAccountByClabe(clabe: string) {
    const rows: { id: string; user_id: string }[] = await this.dataSource.query(
      `SELECT id, user_id FROM accounts WHERE clabe = $1 AND type = 'USER'`,
      [clabe],
    );
    const [row] = rows;
    return row ? { accountId: row.id, ownerId: row.user_id } : null;
  }
}
