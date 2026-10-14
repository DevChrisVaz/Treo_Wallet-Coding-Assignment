import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { buildClabe } from '../../src/modules/accounts/domain/clabe.js';

let sequence = 0;

export interface FixtureUser {
  readonly userId: string;
  readonly principalId: string;
  readonly ahorroId: string;
  readonly principalClabe: string;
  readonly ahorroClabe: string;
}

/** Usuario verificado con sus dos cuentas, insertado directamente con el rol dueño. */
export async function insertUserWithAccounts(migrator: DataSource): Promise<FixtureUser> {
  sequence += 1;
  const userId = randomUUID();
  const tag = userId.replace(/-/g, '').toUpperCase();
  await migrator.query(
    `INSERT INTO app.users (id, email, password_hash, full_name, curp, rfc, phone, email_verified_at)
     VALUES ($1, $2, 'hash', $3, $4, $5, $6, now())`,
    [
      userId,
      `fixture-${tag.toLowerCase().slice(0, 12)}@example.com`,
      `Usuario ${sequence}`,
      tag.slice(0, 18),
      tag.slice(0, 13),
      `+52${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
    ],
  );
  const ids = { principalId: randomUUID(), ahorroId: randomUUID() };
  const clabes: string[] = [];
  for (const [name, id] of [
    ['Principal', ids.principalId],
    ['Ahorro', ids.ahorroId],
  ] as const) {
    const [{ n }] = await migrator.query(`SELECT nextval('app.seq_account_number') AS n`);
    const clabe = buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: BigInt(n) });
    clabes.push(clabe);
    await migrator.query(
      `INSERT INTO app.accounts (id, user_id, type, name, clabe) VALUES ($1, $2, 'USER', $3, $4)`,
      [id, userId, name, clabe],
    );
  }
  return { userId, ...ids, principalClabe: clabes[0] ?? '', ahorroClabe: clabes[1] ?? '' };
}

/** Transferencia OWN mínima con los valores dados (sin asientos). */
export async function insertOwnTransfer(
  db: DataSource,
  values: { userId: string; from: string; to: string; status: string; amountCents: bigint },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                                from_account_id, to_account_id, amount_cents, concept, reference,
                                requires_otp, created_at, completed_at)
     VALUES ($1, $2, $3, repeat('a', 64), 'OWN', $4, $5, $6, $7, 'Prueba', 1, false, now(),
             CASE WHEN $4 = 'COMPLETED' THEN now() END)`,
    [
      id,
      values.userId,
      randomUUID(),
      values.status,
      values.from,
      values.to,
      values.amountCents.toString(),
    ],
  );
  return id;
}
