import type { Transaction } from '../../../shared/transaction.js';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly fullName: string;
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname: string | null;
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  /** Código de entidad de la CURP (`DF`, `JC`, … o `NE`). */
  readonly birthState: string;
  readonly curp: string;
  readonly rfc: string;
  /** E.164 (`+52` + 10 dígitos). */
  readonly phone: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
  /**
   * Registro en revisión (IDN-03): al registrarse, su CURP, RFC o teléfono ya eran de otro usuario.
   * No abre cuentas ni inicia sesión.
   */
  readonly identityConflict: boolean;
}

/** Usuario por crear; sin `identityConflict`, no está en revisión. */
export type NewUser = Omit<UserRecord, 'emailVerifiedAt' | 'identityConflict'> & {
  readonly identityConflict?: boolean;
};

/** El email ya existe (carrera entre dos registros con el mismo email). */
export class EmailAlreadyTaken extends Error {
  constructor() {
    super('El email ya está registrado');
    this.name = 'EmailAlreadyTaken';
  }
}

/** La CURP, el RFC o el teléfono ya pertenecen a otro usuario que no está en revisión (IDN-03). */
export class IdentityAlreadyTaken extends Error {
  constructor() {
    super('Los datos de identidad ya pertenecen a otro usuario');
    this.name = 'IdentityAlreadyTaken';
  }
}

/** Dato de identidad único entre los usuarios que no están en revisión (IDN-03). */
export type IdentityField = 'curp' | 'rfc' | 'phone';

/** Usuario activo que comparte datos de identidad con un registro en revisión (IDN-16). */
export interface IdentityOwner {
  readonly email: string;
  readonly fields: readonly IdentityField[];
}

/** Persistencia de usuarios. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Busca por email y bloquea la fila, para serializar operaciones sobre el mismo usuario. */
  findByEmailForUpdate(tx: Transaction, email: string): Promise<UserRecord | null>;
  /** ¿Alguna de la CURP, el RFC o el teléfono pertenece ya a otro usuario que no está en revisión? */
  identityInUse(
    tx: Transaction,
    identity: { readonly curp: string; readonly rfc: string; readonly phone: string },
  ): Promise<boolean>;
  /** Usuarios que no están en revisión con la CURP, el RFC o el teléfono dados, y cuáles comparten. */
  activeOwnersOf(
    tx: Transaction,
    identity: { readonly curp: string; readonly rfc: string; readonly phone: string },
  ): Promise<readonly IdentityOwner[]>;
  /** Lanza `EmailAlreadyTaken` o `IdentityAlreadyTaken` si la base detecta un duplicado. */
  insert(tx: Transaction, user: NewUser): Promise<void>;
  markEmailVerified(tx: Transaction, userId: string, at: Date): Promise<void>;
}
