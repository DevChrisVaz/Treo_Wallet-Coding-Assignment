import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';
import { signInAgain, waitForLockWaiters, within } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let id: string;

/**
 * Barrera dentro de una transacción: la primera escritura de `action` en la bitácora se detiene
 * (con todos los bloqueos de esa transacción tomados) hasta que la prueba la libera.
 */
let pause: { action: string; reached: () => void; released: Promise<void> } | null = null;

function pauseAt(action: string) {
  let reached!: () => void;
  let release!: () => void;
  const arrived = new Promise<void>((resolve) => (reached = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  pause = { action, reached, released };
  return { arrived, release };
}

beforeEach(async () => {
  pause = null;
  const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
  const audit: AuditWriter = {
    record: async (tx, event) => {
      const current = pause;
      if (current && event.action === current.action) {
        pause = null;
        current.reached();
        await current.released;
      }
      return real.record(tx, event);
    },
    recordStandalone: (event) => real.recordStandalone(event),
  };
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z', overrides: { audit } });
  ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  const beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '5000.00');
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount: '1000.00',
    concept: 'Renta',
    reference: '1',
    scheduledFor: '2026-10-15T06:00:00.000Z',
  });
  id = res.body.id;
  // La programada ya venció: 00:00:30 del 15 en CDMX.
  t.clock.set('2026-10-15T06:00:30.000Z');
  ana = await signInAgain(t, ana);
});

/** La petición HTTP arranca en cuanto se pide su resultado. */
const cancel = () =>
  authed(t, ana.accessToken)
    .post(`/transfers/${id}/cancel`)
    .then((res) => res);

async function outcome() {
  const [row] = await harness.migrator.query(
    `SELECT t.status, (SELECT count(*)::int FROM app.ledger_entries e WHERE e.transfer_id = t.id) AS entries
       FROM app.transfers t WHERE t.id = $1`,
    [id],
  );
  const actions = (await auditEvents(harness.migrator))
    .filter((event) => event.entity_id === id)
    .map((event) => event.action)
    .filter((action) => ['TRANSFER_COMPLETED', 'TRANSFER_CANCELLED'].includes(action));
  return { ...row, actions };
}

describe('TRF-32 cancelación y ejecución al mismo tiempo', () => {
  it('TRF-32 si el ejecutor tiene la fila, la cancelación espera, la ve COMPLETED y responde 409', async () => {
    const executing = pauseAt('TRANSFER_COMPLETED');
    const pass = t.container.scheduler.runner.runOnce();
    await executing.arrived;

    const cancelling = cancel();
    await waitForLockWaiters(harness.migrator, 1);
    executing.release();

    expect(await pass).toEqual({ completed: 1, failed: 0, skipped: 0, errors: 0 });
    const res = await cancelling;
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'TRANSFER_NOT_CANCELLABLE',
      transferStatus: 'COMPLETED',
    });
    expect(await outcome()).toEqual({
      status: 'COMPLETED',
      entries: 2,
      actions: ['TRANSFER_COMPLETED'],
    });
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-32 si la cancelación tiene la fila, el ejecutor la salta sin esperar y gana la cancelación', async () => {
    const cancelling = pauseAt('TRANSFER_CANCELLED');
    const request = cancel();
    await cancelling.arrived;

    const pass = await within(t.container.scheduler.runner.runOnce(), 2_000);
    expect(pass).toEqual({ completed: 0, failed: 0, skipped: 1, errors: 0 });
    cancelling.release();

    const res = await request;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(await t.container.scheduler.runner.runOnce()).toEqual({
      completed: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(await outcome()).toEqual({
      status: 'CANCELLED',
      entries: 0,
      actions: ['TRANSFER_CANCELLED'],
    });
  });

  it('TRF-32 si la cancelación llega mientras el ejecutor espera el contador, gana y el ejecutor la descarta al bloquearla', async () => {
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-15', 0, 5000000)`,
      [ana.userId],
    );
    // Una transferencia manual de Ana tiene el contador: el ejecutor ya leyó la candidata y espera.
    const holder = harness.migrator.createQueryRunner();
    await holder.connect();
    let pass;
    try {
      await holder.startTransaction();
      await holder.query(
        `SELECT 1 FROM app.daily_transfer_usage WHERE user_id = $1 AND day = '2026-10-15' FOR UPDATE`,
        [ana.userId],
      );
      pass = t.container.scheduler.runner.runOnce();
      await waitForLockWaiters(harness.migrator, 1);

      // La cancelación solo bloquea la transferencia: no espera al ejecutor.
      const res = await within(cancel(), 2_000);
      expect(res).not.toBe('bloqueada');
      if (res !== 'bloqueada') {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CANCELLED');
      }
      await holder.commitTransaction();
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }

    expect(await pass).toEqual({ completed: 0, failed: 0, skipped: 1, errors: 0 });
    expect(await outcome()).toEqual({
      status: 'CANCELLED',
      entries: 0,
      actions: ['TRANSFER_CANCELLED'],
    });
    expect(
      t.logs.entries().filter((entry) => entry.level === 'error' || entry.level === 'fatal'),
    ).toEqual([]);
  });
});
