import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { FixtureUser } from './ledger-fixtures.js';

export interface Violation {
  readonly code?: string;
  readonly constraint?: string;
}

/**
 * Error de Postgres (SQLSTATE y nombre de la constraint) con el que falla `promise`, o `undefined`
 * si no falla. Acepta el error de TypeORM (`driverError`) o el de `pg` directo.
 */
export async function violation(promise: Promise<unknown>): Promise<Violation | undefined> {
  try {
    await promise;
  } catch (error) {
    const raw = error as { driverError?: Violation } & Violation;
    return raw.driverError ?? raw;
  }
  return undefined;
}

/** Inserta `row` (columna → valor) en `table` con parámetros; el SQL lo arma el nombre de columna. */
export async function insertRow(
  db: DataSource,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const columns = Object.keys(row);
  await db.query(
    `INSERT INTO ${table} (${columns.join(', ')})
     VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
}

/** Fila válida de `app.beneficiaries`: `owner` registra la cuenta principal de `target`. */
export function beneficiaryRow(
  owner: FixtureUser,
  target: FixtureUser,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: randomUUID(),
    user_id: owner.userId,
    account_id: target.principalId,
    name: 'Luis',
    alias: 'Luis',
    clabe: target.principalClabe,
    ...overrides,
  };
}

/** Fila válida de `app.transfers` OWN PENDING_OTP entre las cuentas de `user`. */
export function ownTransferRow(
  user: FixtureUser,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: randomUUID(),
    user_id: user.userId,
    idempotency_key: randomUUID(),
    request_fingerprint: 'a'.repeat(64),
    kind: 'OWN',
    status: 'PENDING_OTP',
    from_account_id: user.principalId,
    to_account_id: user.ahorroId,
    amount_cents: 500,
    concept: 'Ahorro',
    reference: 1,
    requires_otp: false,
    created_at: new Date(),
    ...overrides,
  };
}
