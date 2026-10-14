import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LedgerPoster } from '../../../src/modules/transfers/application/ledger-poster.js';
import { PgAccountLocks } from '../../../src/modules/transfers/infrastructure/pg-account-locks.js';
import { PgLedgerStore } from '../../../src/modules/transfers/infrastructure/pg-ledger-store.js';
import { PgTransferStore } from '../../../src/modules/transfers/infrastructure/pg-transfer-store.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { Money } from '../../../src/shared/money.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts, type FixtureUser } from '../../helpers/ledger-fixtures.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();

/** Traspaso entre cuentas propias con los mismos componentes que usará createTransfer. */
async function ownTransfer(t: TestApp, user: FixtureUser, amount: string) {
  const runner = new TypeormTransactionRunner(harness.app);
  const locks = new PgAccountLocks(harness.app);
  await runner.run(async (tx) => {
    const id = randomUUID();
    await new PgTransferStore().insert(tx, {
      id,
      userId: user.userId,
      idempotencyKey: randomUUID(),
      fingerprint: 'f'.repeat(64),
      kind: 'OWN',
      status: 'PENDING_OTP',
      fromAccountId: user.principalId,
      toAccountId: user.ahorroId,
      beneficiaryId: null,
      amountCents: Money.parse(amount).cents,
      concept: 'Ahorro',
      reference: 1,
      requiresOtp: false,
      rejectionReason: null,
      failureReason: null,
      otpExpiresAt: null,
      createdAt: t.clock.now(),
      completedAt: null,
      scheduledFor: null,
      cancelledAt: null,
    });
    const locked = await locks.lock(tx, [user.principalId, user.ahorroId], {
      ownedBy: user.userId,
    });
    const byId = new Map(locked.map((account) => [account.id, account]));
    const from = byId.get(user.principalId);
    const to = byId.get(user.ahorroId);
    if (!from || !to) throw new Error('cuentas no bloqueadas');
    await new LedgerPoster(new PgLedgerStore()).post(tx, {
      transferId: id,
      kind: 'OWN',
      from,
      to,
      amount: Money.parse(amount),
      at: t.clock.now(),
    });
  });
  t.clock.advance(1_000);
}

describe('ACC-14 conciliación entre saldos y asientos', () => {
  it('ACC-14 después de fondear y transferir, saldos, suma global y cadena de balance_after cuadran', async () => {
    const t = await buildTestApp(harness);
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    await t.container.ledger.fundAccount.execute({
      account: ana.principalId,
      amount: Money.parse('1000.00'),
    });
    await t.container.ledger.fundAccount.execute({
      account: luis.principalId,
      amount: Money.parse('250.75'),
    });
    await ownTransfer(t, ana, '200.00');
    await ownTransfer(t, ana, '300.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('ACC-14 la conciliación detecta un saldo alterado fuera del ledger', async () => {
    const t = await buildTestApp(harness);
    const ana = await insertUserWithAccounts(harness.migrator);
    await t.container.ledger.fundAccount.execute({
      account: ana.principalId,
      amount: Money.parse('10.00'),
    });
    await harness.migrator.query(`UPDATE app.accounts SET balance_cents = 999 WHERE id = $1`, [
      ana.principalId,
    ]);
    const result = await reconcile(harness.migrator);
    expect(result.mismatchedBalances).toEqual([ana.principalId]);
    expect(result.treasuryGap).not.toBe('0');
  });
});
