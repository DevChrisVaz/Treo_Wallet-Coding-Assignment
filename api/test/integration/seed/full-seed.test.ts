import { describe, expect, it } from 'vitest';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { FundAccount } from '../../../src/modules/transfers/application/fund-account.js';
import { LedgerPoster } from '../../../src/modules/transfers/application/ledger-poster.js';
import { PgAccountLocks } from '../../../src/modules/transfers/infrastructure/pg-account-locks.js';
import { PgLedgerStore } from '../../../src/modules/transfers/infrastructure/pg-ledger-store.js';
import { PgTransferStore } from '../../../src/modules/transfers/infrastructure/pg-transfer-store.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { Money } from '../../../src/shared/money.js';
import { SeedInvariantError, runSeed, verifySeed } from '../../../src/seed/run-seed.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
const now = new Date('2026-10-13T18:00:00.000Z'); // 12:00 de CDMX
const small = {
  clabe: { bankCode: '999', plazaCode: '180' },
  now,
  generatedUsers: 3,
  transfers: 300,
  batchSize: 120,
  monthlyDeposits: 12,
  minEntries: 600,
};

describe('HIS-10 seed completo en pequeño', () => {
  it('HIS-10 deja los saldos en el último balance_after y cumple todas las invariantes', async () => {
    const summary = await runSeed(harness.migrator, small);
    expect(summary).toMatchObject({ entries: 2 * (5 + 12 + 300), anaPrincipalEntries: 313 });
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
    const stale = await harness.migrator.query(
      `SELECT a.id FROM app.accounts a
         JOIN LATERAL (SELECT balance_after_cents FROM app.ledger_entries e WHERE e.account_id = a.id
                        ORDER BY created_at DESC, id DESC LIMIT 1) last ON true
        WHERE a.balance_cents <> last.balance_after_cents`,
    );
    expect(stale).toEqual([]);
    const [{ today }] = await harness.migrator.query(
      `SELECT count(*)::int AS today FROM app.ledger_entries WHERE created_at >= '2026-10-13T06:00:00Z'`,
    );
    expect(today).toBe(0);
  });

  it('HIS-10 correrlo otra vez no cambia nada', async () => {
    await runSeed(harness.migrator, small);
    const again = await runSeed(harness.migrator, small);
    expect(again.entries).toBe(2 * (5 + 12 + 300));
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('HIS-10 la verificación falla si hay un movimiento del día actual de CDMX', async () => {
    const summary = await runSeed(harness.migrator, small);
    const clock = { now: () => new Date('2026-10-13T17:00:00.000Z') };
    await new FundAccount({
      transactions: new TypeormTransactionRunner(harness.migrator),
      transfers: new PgTransferStore(),
      locks: new PgAccountLocks(harness.migrator),
      poster: new LedgerPoster(new PgLedgerStore()),
      audit: new PgAuditWriter(harness.migrator, clock),
      clock,
    }).execute({ account: summary.anaPrincipalId, amount: Money.parse('1.00') });
    const failure = await verifySeed(harness.migrator, { now, minEntries: 600 }).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(SeedInvariantError);
    expect((failure as SeedInvariantError).failures).toEqual([
      'hay 2 asientos del día actual de America/Mexico_City',
    ]);
  });

  it('HIS-10 la verificación falla si hay menos asientos de los pedidos', async () => {
    await runSeed(harness.migrator, small);
    await expect(verifySeed(harness.migrator, { now, minEntries: 100_000 })).rejects.toThrow(
      /se esperaban al menos 100000 asientos/,
    );
  });
});
