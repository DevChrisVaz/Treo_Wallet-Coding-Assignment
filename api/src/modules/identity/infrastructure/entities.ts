import { EntitySchema } from 'typeorm';

/** Fila de `users` tal como la mapea TypeORM (sin decoradores: el dominio no conoce el ORM). */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
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
    curp: { type: 'char', length: 18 },
    rfc: { type: 'char', length: 13 },
    phone: { type: 'text' },
    emailVerifiedAt: { type: 'timestamptz', name: 'email_verified_at', nullable: true },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});
