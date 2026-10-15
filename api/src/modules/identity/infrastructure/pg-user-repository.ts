import type { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../../platform/persistence/pg-errors.js';
import {
  queryForUpdate,
  queryIn,
  queryRunnerOf,
} from '../../../platform/persistence/transaction.js';
import type { Transaction } from '../../../shared/transaction.js';
import {
  EmailAlreadyTaken,
  IdentityAlreadyTaken,
  type IdentityField,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from '../application/users.js';
import { UserEntity, type UserRow } from './entities.js';

const IDENTITY_FIELDS: readonly IdentityField[] = ['curp', 'rfc', 'phone'];

/** Constraint única que protege cada dato de identidad. */
const IDENTITY_CONSTRAINTS: Record<IdentityField, string> = {
  curp: 'uq_users_curp',
  rfc: 'uq_users_rfc',
  phone: 'uq_users_phone',
};

interface RawUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  curp: string;
  rfc: string;
  phone: string;
  email_verified_at: Date | null;
  created_at: Date;
}

function fromRaw(row: RawUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    curp: row.curp,
    rfc: row.rfc,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
  };
}

/** Usuarios en PostgreSQL: TypeORM para lecturas e inserciones simples, SQL para los bloqueos. */
export class PgUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.dataSource.getRepository(UserEntity).findOneBy({ email });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.dataSource.getRepository(UserEntity).findOneBy({ id });
  }

  async findByEmailForUpdate(tx: Transaction, email: string): Promise<UserRecord | null> {
    const [row] = await queryForUpdate<RawUser>(
      tx,
      `SELECT id, email, password_hash, full_name, curp, rfc, phone, email_verified_at, created_at
         FROM users WHERE email = $1 FOR UPDATE`,
      [email],
    );
    return row ? fromRaw(row) : null;
  }

  async identityInUse(
    tx: Transaction,
    identity: { curp: string; rfc: string; phone: string },
  ): Promise<readonly IdentityField[]> {
    const rows = await queryIn(
      tx,
      `SELECT coalesce(bool_or(curp = $1), false) AS curp,
              coalesce(bool_or(rfc = $2), false) AS rfc,
              coalesce(bool_or(phone = $3), false) AS phone
         FROM users WHERE curp = $1 OR rfc = $2 OR phone = $3`,
      [identity.curp, identity.rfc, identity.phone],
    );
    const found = (rows[0] ?? {}) as Record<IdentityField, boolean>;
    return IDENTITY_FIELDS.filter((field) => found[field]);
  }

  async insert(tx: Transaction, user: NewUser): Promise<void> {
    const row: UserRow = { ...user, emailVerifiedAt: null };
    try {
      await queryRunnerOf(tx).manager.insert(UserEntity, row);
    } catch (error) {
      if (isUniqueViolation(error, ['uq_users_email'])) throw new EmailAlreadyTaken();
      for (const [field, constraint] of Object.entries(IDENTITY_CONSTRAINTS)) {
        if (isUniqueViolation(error, [constraint])) {
          throw new IdentityAlreadyTaken([field as IdentityField]);
        }
      }
      throw error;
    }
  }

  async markEmailVerified(tx: Transaction, userId: string, at: Date): Promise<void> {
    await queryIn(tx, `UPDATE users SET email_verified_at = $2 WHERE id = $1`, [userId, at]);
  }
}
