import type { MigrationInterface } from 'typeorm';
import { AuditLog1760400000000 } from './1760400000000-audit-log.js';
import { Users1760400001000 } from './1760400001000-users.js';
import { Accounts1760400002000 } from './1760400002000-accounts.js';

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (sin globs) para que funcionen igual
 * con tsx, con el build y en las pruebas.
 */
export const migrations: (new () => MigrationInterface)[] = [
  AuditLog1760400000000,
  Users1760400001000,
  Accounts1760400002000,
];
