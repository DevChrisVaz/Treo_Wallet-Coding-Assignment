import { EntitySchema } from 'typeorm';

/** Fila de `users` tal como la mapea TypeORM (sin decoradores: el dominio no conoce el ORM). */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  firstNames: string;
  paternalSurname: string;
  maternalSurname: string | null;
  birthDate: string;
  birthState: string;
  curp: string;
  rfc: string;
  phone: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export const UserEntity = new EntitySchema<UserRow>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true },
    email: { type: 'text' },
    passwordHash: { type: 'text', name: 'password_hash' },
    fullName: { type: 'text', name: 'full_name' },
    firstNames: { type: 'text', name: 'first_names' },
    paternalSurname: { type: 'text', name: 'paternal_surname' },
    maternalSurname: { type: 'text', name: 'maternal_surname', nullable: true },
    birthDate: { type: 'date', name: 'birth_date' },
    birthState: { type: 'char', length: 2, name: 'birth_state' },
    curp: { type: 'char', length: 18 },
    rfc: { type: 'char', length: 13 },
    phone: { type: 'text' },
    emailVerifiedAt: { type: 'timestamptz', name: 'email_verified_at', nullable: true },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});
