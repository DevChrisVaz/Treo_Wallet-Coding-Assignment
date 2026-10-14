import request from 'supertest';
import { expect } from 'vitest';
import { Money } from '../../src/shared/money.js';
import type { TestApp } from './app.js';
import { expectToMatchContract } from './contract.js';
import type { IntegrationHarness } from './harness.js';
import { verifiedUser, type VerifiedUser } from './identity.js';

export interface LedgerUser extends VerifiedUser {
  readonly principal: { id: string; clabe: string };
  readonly ahorro: { id: string; clabe: string };
}

/** Usuario verificado por la API con los ids y CLABE de sus dos cuentas. */
export async function ledgerUser(t: TestApp, harness: IntegrationHarness): Promise<LedgerUser> {
  const user = await verifiedUser(t);
  const rows: { id: string; name: string; clabe: string }[] = await harness.migrator.query(
    `SELECT id, name, clabe FROM app.accounts WHERE user_id = $1`,
    [user.userId],
  );
  const find = (name: string) => {
    const row = rows.find((r) => r.name === name);
    if (!row) throw new Error(`Falta la cuenta ${name}`);
    return { id: row.id, clabe: row.clabe };
  };
  return { ...user, principal: find('Principal'), ahorro: find('Ahorro') };
}

export async function fund(t: TestApp, accountId: string, amount: string): Promise<void> {
  await t.container.ledger.fundAccount.execute({ account: accountId, amount: Money.parse(amount) });
}

export function authed(t: TestApp, token: string) {
  return {
    get: (path: string) => request(t.app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string) => request(t.app).post(path).set('Authorization', `Bearer ${token}`),
  };
}

/** Registra un beneficiario por la API y devuelve su id. */
export async function addBeneficiary(
  t: TestApp,
  owner: VerifiedUser,
  body: { name: string; alias: string; clabe: string },
): Promise<string> {
  const res = await authed(t, owner.accessToken).post('/beneficiaries').send(body);
  expectToMatchContract(res, 'createBeneficiary');
  expect([200, 201]).toContain(res.status);
  return res.body.id as string;
}

/** POST /transfers verificado contra el contrato. */
export async function postTransfer(
  t: TestApp,
  owner: VerifiedUser,
  body: Record<string, unknown>,
  key: string | null = crypto.randomUUID(),
) {
  const req = authed(t, owner.accessToken).post('/transfers');
  const res = await (key ? req.set('Idempotency-Key', key) : req).send(body);
  expectToMatchContract(res, 'createTransfer');
  return res;
}

export async function balanceOf(harness: IntegrationHarness, accountId: string): Promise<string> {
  const [row] = await harness.migrator.query(
    'SELECT balance_cents FROM app.accounts WHERE id = $1',
    [accountId],
  );
  return Money.fromCents(BigInt(row.balance_cents)).toDecimalString();
}
