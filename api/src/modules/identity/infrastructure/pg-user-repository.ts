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
  type IdentityOwner,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from '../application/users.js';
import { UserEntity, type UserRow } from './entities.js';

interface RawUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  first_names: string;
  paternal_surname: string;
  maternal_surname: string | null;
  birth_date: string;
  birth_state: string;
  curp: string;
  rfc: string;
  phone: string;
  email_verified_at: Date | null;
  created_at: Date;
  identity_conflict: boolean;
}

function fromRaw(row: RawUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    firstNames: row.first_names,
    paternalSurname: row.paternal_surname,
    maternalSurname: row.maternal_surname,
    birthDate: row.birth_date,
    birthState: row.birth_state,
    curp: row.curp,
    rfc: row.rfc,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    identityConflict: row.identity_conflict,
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
      `SELECT id, email, password_hash, full_name, first_names, paternal_surname, maternal_surname,
              birth_date::text AS birth_date, birth_state, curp, rfc, phone, email_verified_at, created_at,
              identity_conflict
         FROM users WHERE email = $1 FOR UPDATE`,
      [email],
    );
    return row ? fromRaw(row) : null;
  }

  async identityInUse(
    tx: Transaction,
    identity: { curp: string; rfc: string; phone: string },
  ): Promise<boolean> {
    const rows = await queryIn(
      tx,
      `SELECT 1 FROM users
        WHERE NOT identity_conflict AND (curp = $1 OR rfc = $2 OR phone = $3) LIMIT 1`,
      [identity.curp, identity.rfc, identity.phone],
    );
    return rows.length > 0;
  }

  async activeOwnersOf(
    tx: Transaction,
    identity: { curp: string; rfc: string; phone: string },
  ): Promise<readonly IdentityOwner[]> {
    const rows = await queryIn<{ email: string } & Record<IdentityField, boolean>>(
      tx,
      `SELECT email, curp = $1 AS curp, rfc = $2 AS rfc, phone = $3 AS phone
         FROM users
        WHERE NOT identity_conflict AND (curp = $1 OR rfc = $2 OR phone = $3)
        ORDER BY created_at, id`,
      [identity.curp, identity.rfc, identity.phone],
    );
    const fields: readonly IdentityField[] = ['curp', 'rfc', 'phone'];
    return rows.map((row) => ({ email: row.email, fields: fields.filter((field) => row[field]) }));
  }

  async insert(tx: Transaction, user: NewUser): Promise<void> {
    const row: UserRow = {
      ...user,
      emailVerifiedAt: null,
      identityConflict: user.identityConflict ?? false,
    };
    try {
      await queryRunnerOf(tx).manager.insert(UserEntity, row);
    } catch (error) {
      if (isUniqueViolation(error, ['uq_users_email'])) throw new EmailAlreadyTaken();
      if (isUniqueViolation(error, ['uq_users_curp', 'uq_users_rfc', 'uq_users_phone'])) {
        throw new IdentityAlreadyTaken();
      }
      throw error;
    }
  }

  async markEmailVerified(tx: Transaction, userId: string, at: Date): Promise<void> {
    await queryIn(tx, `UPDATE users SET email_verified_at = $2 WHERE id = $1`, [userId, at]);
  }
}
