import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { expect } from 'vitest';
import type { TestApp } from './app.js';
import { expectToMatchContract } from './contract.js';
import type { VerifiedUser } from './identity.js';

/** Espera a que haya al menos `n` bloqueos sin conceder en la base (una transacción esperando). */
export async function waitForLockWaiters(db: DataSource, n: number): Promise<void> {
  for (let i = 0; i < 150; i++) {
    const [{ waiting }] = await db.query(
      'SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted',
    );
    if (waiting >= n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No hubo ${n} bloqueos en espera`);
}

/** Resuelve con `'bloqueada'` si la promesa no termina en `ms`. */
export function within<T>(promise: Promise<T>, ms: number): Promise<T | 'bloqueada'> {
  return Promise.race([
    promise,
    new Promise<'bloqueada'>((resolve) => setTimeout(() => resolve('bloqueada'), ms)),
  ]);
}

/**
 * Inicia sesión otra vez a la hora actual del reloj falso: las pruebas del ejecutor mueven el reloj
 * horas o días y el access token dura 10 minutos. Devuelve el usuario con su token nuevo.
 */
export async function signInAgain<U extends VerifiedUser>(t: TestApp, user: U): Promise<U> {
  const res = await request(t.app)
    .post('/auth/login')
    .send({ email: user.person.email.trim().toLowerCase(), password: user.person.password });
  expectToMatchContract(res, 'login');
  expect(res.status).toBe(200);
  return { ...user, accessToken: res.body.tokens.accessToken };
}

/** Dueño de las transferencias: sus dos cuentas (la programada va de "Principal" a "Ahorro"). */
export interface ScheduledOwner {
  readonly userId: string;
  readonly principal: { readonly id: string };
  readonly ahorro: { readonly id: string };
}

export interface ScheduledRowOptions {
  readonly status?: 'SCHEDULED' | 'PENDING_OTP' | 'CANCELLED' | 'FAILED';
  readonly scheduledFor?: string | null;
  readonly otpExpiresAt?: string | null;
  readonly cancelledAt?: string | null;
  readonly failureReason?: 'INSUFFICIENT_FUNDS' | 'DAILY_LIMIT_EXCEEDED' | null;
  readonly amountCents?: bigint;
  /** Momento de creación de la primera; las siguientes van un milisegundo después cada una. */
  readonly createdAt?: string;
}

/**
 * Inserta `count` transferencias OWN programadas, sin asientos, directamente con el rol dueño (para
 * preparar escenarios como el tope de 20 sin pasar por la API). Devuelve sus ids en orden de
 * creación.
 */
export async function insertScheduledTransfers(
  migrator: DataSource,
  owner: ScheduledOwner,
  count: number,
  options: ScheduledRowOptions = {},
): Promise<string[]> {
  const ids: string[] = [];
  const start = new Date(options.createdAt ?? '2026-10-14T17:00:00.000Z').getTime();
  for (let i = 0; i < count; i += 1) {
    const id = randomUUID();
    ids.push(id);
    await migrator.query(
      `INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                  from_account_id, to_account_id, amount_cents, concept, reference,
                                  requires_otp, failure_reason, otp_expires_at, created_at,
                                  scheduled_for, cancelled_at)
       VALUES ($1, $2, $3, repeat('e', 64), 'OWN', $4, $5, $6, $7, 'Programada de prueba', $8,
               $9, $10, $11, $12, $13::date, $14)`,
      [
        id,
        owner.userId,
        randomUUID(),
        options.status ?? 'SCHEDULED',
        owner.principal.id,
        owner.ahorro.id,
        (options.amountCents ?? 10_000n).toString(),
        i,
        (options.amountCents ?? 10_000n) > 1_000_000n,
        options.failureReason ?? null,
        options.otpExpiresAt ?? null,
        new Date(start + i),
        options.scheduledFor === undefined ? '2026-10-20' : options.scheduledFor,
        options.cancelledAt ?? null,
      ],
    );
  }
  return ids;
}
