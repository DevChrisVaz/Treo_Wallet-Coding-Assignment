import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { curpBirthDate, curpBirthState } from '@devchrisvaz/wallet-contract';
import { OpenDefaultAccounts } from '../modules/accounts/application/open-default-accounts.js';
import { PgAccountRepository } from '../modules/accounts/infrastructure/pg-account-repository.js';
import { composeFullName } from '../modules/identity/domain/full-name.js';
import { Argon2PasswordHasher } from '../modules/identity/infrastructure/argon2-password-hasher.js';
import { PgUserRepository } from '../modules/identity/infrastructure/pg-user-repository.js';
import { systemClock } from '../platform/clock/system-clock.js';
import { TypeormTransactionRunner } from '../platform/persistence/transaction.js';
import type { Clock } from '../shared/clock.js';
import type { SeedPerson } from './generated-users.js';

/**
 * Usuarios demo, verificados, con credenciales documentadas en el README. CURP y RFC son sintéticos
 * con dígito verificador y fecha válidos; no corresponden a personas reales.
 */
export const DEMO_USERS: readonly SeedPerson[] = [
  {
    email: 'ana@example.com',
    password: 'Ana-demo-2026!',
    firstNames: 'Ana',
    paternalSurname: 'Gómez',
    maternalSurname: 'Cruz',
    curp: 'GOCA920315MDFMRN07',
    rfc: 'GOCA920315AB1',
    phone: '+525512345001',
  },
  {
    email: 'luis@example.com',
    password: 'Luis-demo-2026!',
    firstNames: 'Luis',
    paternalSurname: 'Pérez',
    maternalSurname: 'López',
    curp: 'PELL900722HDFRPS04',
    rfc: 'PELL900722CD2',
    phone: '+525512345002',
  },
];

export interface SeedOptions {
  readonly clabe: { readonly bankCode: string; readonly plazaCode: string };
  readonly clock?: Clock;
}

/** Crea a Ana y a Luis (ver `seedUsers`). */
export function seedDemoUsers(
  migrator: DataSource,
  options: SeedOptions,
): Promise<Map<string, string>> {
  return seedUsers(migrator, DEMO_USERS, options);
}

/**
 * Crea usuarios verificados con sus dos cuentas, con el rol dueño del esquema. Es idempotente: un
 * usuario que ya existe (por email) se deja como está. Cada contraseña distinta se hashea una sola
 * vez (los usuarios generados comparten la suya). Devuelve los ids por email.
 */
export async function seedUsers(
  migrator: DataSource,
  people: readonly SeedPerson[],
  options: SeedOptions,
): Promise<Map<string, string>> {
  const clock = options.clock ?? systemClock;
  const hasher = await Argon2PasswordHasher.create();
  const users = new PgUserRepository(migrator);
  const openAccounts = new OpenDefaultAccounts({
    accounts: new PgAccountRepository(migrator),
    clabe: options.clabe,
    clock,
  });
  const transactions = new TypeormTransactionRunner(migrator);
  const ids = new Map<string, string>();

  const hashes = new Map<string, string>();

  for (const demo of people) {
    const passwordHash = hashes.get(demo.password) ?? (await hasher.hash(demo.password));
    hashes.set(demo.password, passwordHash);
    const id = await transactions.run(async (tx) => {
      const existing = await users.findByEmailForUpdate(tx, demo.email);
      if (existing) return existing.id;
      const now = clock.now();
      const userId = randomUUID();
      await users.insert(tx, {
        id: userId,
        email: demo.email,
        passwordHash,
        fullName: composeFullName(demo),
        firstNames: demo.firstNames,
        paternalSurname: demo.paternalSurname,
        maternalSurname: demo.maternalSurname,
        birthDate: curpBirthDate(demo.curp) as string,
        birthState: curpBirthState(demo.curp) as string,
        curp: demo.curp,
        rfc: demo.rfc,
        phone: demo.phone,
        createdAt: now,
      });
      await users.markEmailVerified(tx, userId, now);
      await openAccounts.execute(tx, userId);
      return userId;
    });
    ids.set(demo.email, id);
  }
  return ids;
}
