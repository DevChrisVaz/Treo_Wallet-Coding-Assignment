import type { MigrationInterface } from 'typeorm';
import { RegistrationBirthData1760900000000 } from './1760900000000-registration-birth-data.js';
import { AuditLog1760400000000 } from './1760400000000-audit-log.js';
import { Users1760400001000 } from './1760400001000-users.js';
import { Accounts1760400002000 } from './1760400002000-accounts.js';
import { SessionsAndCodes1760400003000 } from './1760400003000-sessions-and-codes.js';
import { Beneficiaries1760500000000 } from './1760500000000-beneficiaries.js';
import { Transfers1760500001000 } from './1760500001000-transfers.js';
import { LedgerEntries1760500002000 } from './1760500002000-ledger-entries.js';
import { LedgerZeroSum1760500003000 } from './1760500003000-ledger-zero-sum.js';
import { LedgerImmutable1760500004000 } from './1760500004000-ledger-immutable.js';
import { DailyTransferUsage1760500005000 } from './1760500005000-daily-transfer-usage.js';
import { AuditStatementExported1760600000000 } from './1760600000000-audit-statement-exported.js';
import { ScheduledTransfers1760700000000 } from './1760700000000-scheduled-transfers.js';
import { AuditScheduledTransfers1760700001000 } from './1760700001000-audit-scheduled-transfers.js';
import { OptionalTransferReference1760800000000 } from './1760800000000-optional-transfer-reference.js';
import { ScheduledForInstant1760800001000 } from './1760800001000-scheduled-for-instant.js';

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (sin globs) para que funcionen igual
 * con tsx, con el build y en las pruebas.
 */
export const migrations: (new () => MigrationInterface)[] = [
  AuditLog1760400000000,
  Users1760400001000,
  Accounts1760400002000,
  SessionsAndCodes1760400003000,
  Beneficiaries1760500000000,
  Transfers1760500001000,
  LedgerEntries1760500002000,
  LedgerZeroSum1760500003000,
  LedgerImmutable1760500004000,
  DailyTransferUsage1760500005000,
  AuditStatementExported1760600000000,
  ScheduledTransfers1760700000000,
  AuditScheduledTransfers1760700001000,
  OptionalTransferReference1760800000000,
  ScheduledForInstant1760800001000,
  RegistrationBirthData1760900000000,
];
