import type { Transaction } from '../../../shared/transaction.js';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly fullName: string;
  readonly curp: string;
  readonly rfc: string;
  /** E.164 (`+52` + 10 dígitos). */
  readonly phone: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
}

export type NewUser = Omit<UserRecord, 'emailVerifiedAt'>;

/** El email ya existe (carrera entre dos registros con el mismo email). */
export class EmailAlreadyTaken extends Error {
  constructor() {
    super('El email ya está registrado');
    this.name = 'EmailAlreadyTaken';
  }
}

/** Dato de identidad único que puede pertenecer ya a otro usuario. */
export type IdentityField = 'curp' | 'rfc' | 'phone';

/** La CURP, el RFC o el teléfono ya pertenecen a otro usuario (IDN-03); `fields` dice cuáles. */
export class IdentityAlreadyTaken extends Error {
  constructor(readonly fields: readonly IdentityField[]) {
    super('Los datos de identidad ya pertenecen a otro usuario');
    this.name = 'IdentityAlreadyTaken';
  }
}

/** Persistencia de usuarios. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Busca por email y bloquea la fila, para serializar operaciones sobre el mismo usuario. */
  findByEmailForUpdate(tx: Transaction, email: string): Promise<UserRecord | null>;
  /** ¿Cuáles de la CURP, el RFC y el teléfono pertenecen ya a otro usuario? (en ese orden). */
  identityInUse(
    tx: Transaction,
    identity: { readonly curp: string; readonly rfc: string; readonly phone: string },
  ): Promise<readonly IdentityField[]>;
  /** Lanza `EmailAlreadyTaken` o `IdentityAlreadyTaken` si la base detecta un duplicado. */
  insert(tx: Transaction, user: NewUser): Promise<void>;
  markEmailVerified(tx: Transaction, userId: string, at: Date): Promise<void>;
}
