import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  balanceOf,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let beneficiaryId: string;
/** Transferencia cuya auditoría de ejecución se hace fallar (`null`: ninguna). */
let failFor: string | null;

beforeEach(async () => {
  failFor = null;
  const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
  const audit: AuditWriter = {
    record: async (tx, event) => {
      if (
        event.entity?.id === failFor &&
        (event.action === 'TRANSFER_COMPLETED' || event.action === 'TRANSFER_FAILED')
      ) {
        throw new Error('falla forzada de auditoría');
      }
      return real.record(tx, event);
    },
    recordStandalone: (event) => real.recordStandalone(event),
  };
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z', overrides: { audit } });
  ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

async function schedule(amount: string, reference: string) {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Renta',
    reference,
    scheduledFor: '2026-10-15',
  });
  expect(res.status).toBe(201);
  t.clock.advance(1_000);
  return res.body.id as string;
}

async function stateOf(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT t.status, (SELECT count(*)::int FROM app.ledger_entries e WHERE e.transfer_id = t.id) AS entries
       FROM app.transfers t WHERE t.id = $1`,
    [id],
  );
  return row;
}

describe('TRF-36 falla de la auditoría al ejecutar', () => {
  it('TRF-36 la transferencia sigue en SCHEDULED sin asientos, la pasada sigue con las demás y la siguiente la ejecuta', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const first = await schedule('1000.00', '1');
    const second = await schedule('500.00', '2');
    t.clock.set('2026-10-15T06:00:30.000Z');
    failFor = first;

    const pass = await t.container.scheduler.runner.runOnce();

    expect(pass).toEqual({ completed: 1, failed: 0, skipped: 0, errors: 1 });
    expect(await stateOf(first)).toEqual({ status: 'SCHEDULED', entries: 0 });
    expect(await stateOf(second)).toEqual({ status: 'COMPLETED', entries: 2 });
    expect(await balanceOf(harness, ana.principal.id)).toBe('4500.00');
    const [usage] = await harness.migrator.query(
      `SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1 AND day = '2026-10-15'`,
      [ana.userId],
    );
    expect(usage.used_cents).toBe('50000');
    const logged = t.logs
      .entries()
      .find((entry) => entry.msg === 'scheduled transfer execution failed');
    expect(logged).toMatchObject({ level: 'error', transferId: first });

    failFor = null;
    t.clock.advance(60_000);
    expect(await t.container.scheduler.runner.runOnce()).toEqual({
      completed: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(await stateOf(first)).toEqual({ status: 'COMPLETED', entries: 2 });
    const executions = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === first && event.action === 'TRANSFER_COMPLETED',
    );
    expect(executions).toHaveLength(1);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-36 si falla la auditoría de una FAILED, no queda FAILED ni se envía el aviso: se reintenta después', async () => {
    const id = await schedule('1000.00', '1');
    t.clock.set('2026-10-15T06:00:30.000Z');
    failFor = id;
    t.mailer.clear();

    const pass = await t.container.scheduler.runner.runOnce();

    expect(pass).toEqual({ completed: 0, failed: 0, skipped: 0, errors: 1 });
    expect(await stateOf(id)).toEqual({ status: 'SCHEDULED', entries: 0 });
    expect(t.mailer.sent).toEqual([]);

    failFor = null;
    await t.container.scheduler.runner.runOnce();
    expect(await stateOf(id)).toEqual({ status: 'FAILED', entries: 0 });
    expect(t.mailer.sent).toHaveLength(1);
  });
});
