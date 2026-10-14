import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();

/** 14 de octubre de 2026, 12:00 en CDMX: se programa para el 15. */
const OCT_14_NOON = '2026-10-14T18:00:00.000Z';
/** 00:00:30 del 15 en CDMX: las programadas del 15 ya vencieron. */
const OCT_15_RUN = '2026-10-15T06:00:30.000Z';

/** Espera a que haya al menos `n` bloqueos sin conceder en la base. */
async function waitForWaiters(n: number): Promise<void> {
  for (let i = 0; i < 150; i++) {
    const [{ waiting }] = await harness.migrator.query(
      'SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted',
    );
    if (waiting >= n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No hubo ${n} bloqueos en espera`);
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | 'bloqueada'> {
  return Promise.race([
    promise,
    new Promise<'bloqueada'>((resolve) => setTimeout(() => resolve('bloqueada'), ms)),
  ]);
}

async function scheduleOwn(t: TestApp, user: LedgerUser, amount: string, reference: string) {
  const res = await postTransfer(t, user, {
    fromAccountId: user.principal.id,
    destination: { type: 'OWN_ACCOUNT', accountId: user.ahorro.id },
    amount,
    concept: 'Ahorro programado',
    reference,
    scheduledFor: '2026-10-15',
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function scheduleTo(
  t: TestApp,
  user: LedgerUser,
  beneficiaryId: string,
  amount: string,
  reference: string,
) {
  const res = await postTransfer(t, user, {
    fromAccountId: user.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Pago programado',
    reference,
    scheduledFor: '2026-10-15',
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

/** Estado, asientos y eventos de ejecución de cada transferencia programada. */
async function executionReport(ids: readonly string[]) {
  const rows: { id: string; status: string; entries: number }[] = await harness.migrator.query(
    `SELECT t.id, t.status, (SELECT count(*)::int FROM app.ledger_entries e WHERE e.transfer_id = t.id) AS entries
       FROM app.transfers t WHERE t.id = ANY($1)`,
    [ids],
  );
  const events = (await auditEvents(harness.migrator)).filter(
    (event) => event.action === 'TRANSFER_COMPLETED' || event.action === 'TRANSFER_FAILED',
  );
  return rows.map((row) => ({
    ...row,
    executions: events.filter((event) => event.entity_id === row.id).length,
  }));
}

describe('TRF-31 ejecución única ante concurrencia', () => {
  it('TRF-31 dos ejecutores sobre 50 programadas vencidas: cada una COMPLETED o FAILED una sola vez y el ledger concilia', async () => {
    // Dos instancias de la API sobre la misma base (mismo pool), cada una con su ejecutor.
    const first = await buildTestApp(harness, { now: OCT_14_NOON });
    const second = await buildTestApp(harness, { now: OCT_14_NOON });
    const users: LedgerUser[] = [];
    for (let i = 0; i < 5; i += 1) users.push(await ledgerUser(first, harness));
    const ids: string[] = [];
    for (const [index, user] of users.entries()) {
      const next = users[(index + 1) % users.length] as LedgerUser;
      const beneficiaryId = await addBeneficiary(first, user, {
        name: `Persona ${index + 1}`,
        alias: `Siguiente ${index + 1}`,
        clabe: next.principal.clabe,
      });
      // Fondos para unas 7 de 10: algunas fallan por saldo según el orden en que lleguen las entradas.
      await fund(first, user.principal.id, '700.00');
      for (let n = 0; n < 5; n += 1) {
        ids.push(await scheduleTo(first, user, beneficiaryId, '100.00', `${n}`));
        ids.push(await scheduleOwn(first, user, '100.00', `${n + 5}`));
      }
    }
    expect(ids).toHaveLength(50);
    first.clock.set(OCT_15_RUN);
    second.clock.set(OCT_15_RUN);

    const [a, b] = await Promise.all([
      first.container.scheduler.runner.runOnce(),
      second.container.scheduler.runner.runOnce(),
    ]);

    const report = await executionReport(ids);
    expect(report).toHaveLength(50);
    for (const row of report) {
      expect(['COMPLETED', 'FAILED'], row.id).toContain(row.status);
      expect(row.entries, row.id).toBe(row.status === 'COMPLETED' ? 2 : 0);
      expect(row.executions, row.id).toBe(1);
    }
    const completed = report.filter((row) => row.status === 'COMPLETED').length;
    expect(a.completed + b.completed).toBe(completed);
    expect(a.failed + b.failed).toBe(50 - completed);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
    // El uso del día de cada usuario es la suma de sus completadas a terceros.
    const usage: { mismatched: number }[] = await harness.migrator.query(
      `SELECT count(*)::int AS mismatched FROM app.daily_transfer_usage u
        WHERE u.day = '2026-10-15' AND u.used_cents <> (
          SELECT COALESCE(sum(t.amount_cents), 0) FROM app.transfers t
           WHERE t.user_id = u.user_id AND t.kind = 'THIRD_PARTY' AND t.status = 'COMPLETED')`,
    );
    expect(usage[0]?.mismatched).toBe(0);
    for (const t of [first, second]) {
      expect(t.logs.text()).not.toContain('40P01');
      expect(t.logs.entries().filter((entry) => Number(entry.level) >= 50)).toEqual([]);
    }
  });

  it('TRF-31 un ejecutor no espera a otro: salta la programada que otra instancia tiene bloqueada', async () => {
    const t = await buildTestApp(harness, { now: OCT_14_NOON });
    const ana = await ledgerUser(t, harness);
    await fund(t, ana.principal.id, '1000.00');
    const held = await scheduleOwn(t, ana, '100.00', '1');
    const free = await scheduleOwn(t, ana, '100.00', '2');
    t.clock.set(OCT_15_RUN);

    // Otra instancia (o una cancelación) tiene la primera bloqueada a mitad de su transacción.
    const other = harness.migrator.createQueryRunner();
    await other.connect();
    try {
      await other.startTransaction();
      await other.query(`SELECT 1 FROM app.transfers WHERE id = $1 FOR NO KEY UPDATE`, [held]);

      const pass = await within(t.container.scheduler.runner.runOnce(), 2_000);

      expect(pass).toEqual({ completed: 1, failed: 0, skipped: 1 });
      const statuses = await harness.migrator.query(
        `SELECT id, status FROM app.transfers WHERE id = ANY($1)`,
        [[held, free]],
      );
      expect(
        Object.fromEntries(
          statuses.map((row: { id: string; status: string }) => [row.id, row.status]),
        ),
      ).toEqual({
        [held]: 'SCHEDULED',
        [free]: 'COMPLETED',
      });
    } finally {
      await other.rollbackTransaction();
      await other.release();
    }
    // La siguiente pasada la ejecuta.
    await t.container.scheduler.runner.runOnce();
    const [row] = await harness.migrator.query(`SELECT status FROM app.transfers WHERE id = $1`, [
      held,
    ]);
    expect(row.status).toBe('COMPLETED');
  });

  it('TRF-31 orden global: el ejecutor espera la fila contador sin retener todavía la transferencia', async () => {
    const t = await buildTestApp(harness, { now: OCT_14_NOON });
    const ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '1000.00');
    const id = await scheduleTo(t, ana, beneficiaryId, '100.00', '1');
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-15', 0, 5000000)`,
      [ana.userId],
    );
    t.clock.set(OCT_15_RUN);

    // Una transferencia manual de Ana tiene su fila contador del 15.
    const manual = harness.migrator.createQueryRunner();
    await manual.connect();
    let pass;
    try {
      await manual.startTransaction();
      await manual.query(
        `SELECT 1 FROM app.daily_transfer_usage WHERE user_id = $1 AND day = '2026-10-15' FOR UPDATE`,
        [ana.userId],
      );
      pass = t.container.scheduler.runner.runOnce();
      await waitForWaiters(1);

      // Mientras el ejecutor espera el contador, la transferencia sigue libre: una cancelación
      // (que solo bloquea la transferencia) no quedaría detrás de él.
      const probe = harness.migrator.createQueryRunner();
      await probe.connect();
      try {
        await probe.startTransaction();
        const rows = await probe.query(
          `SELECT status FROM app.transfers WHERE id = $1 FOR NO KEY UPDATE NOWAIT`,
          [id],
        );
        expect(rows).toEqual([{ status: 'SCHEDULED' }]);
      } finally {
        await probe.rollbackTransaction();
        await probe.release();
      }
      await manual.commitTransaction();
    } finally {
      if (manual.isTransactionActive) await manual.rollbackTransaction();
      await manual.release();
    }
    expect(await pass).toEqual({ completed: 1, failed: 0, skipped: 0 });
  });

  it('TRF-31 el ejecutor contra transferencias manuales desde la misma cuenta: sin deadlocks y con el saldo conciliado', async () => {
    const t = await buildTestApp(harness, { now: OCT_14_NOON });
    let ana = await ledgerUser(t, harness);
    let luis = await ledgerUser(t, harness);
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    const toAna = await addBeneficiary(t, luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    await fund(t, ana.principal.id, '3000.00');
    await fund(t, luis.principal.id, '3000.00');
    const scheduled: string[] = [];
    for (let n = 0; n < 10; n += 1) {
      scheduled.push(await scheduleTo(t, ana, toLuis, '100.00', `${n}`));
      scheduled.push(await scheduleOwn(t, ana, '50.00', `${n + 10}`));
    }
    t.clock.set(OCT_15_RUN);
    ana = await signInAgain(t, ana);
    luis = await signInAgain(t, luis);

    const manual = Array.from({ length: 15 }, (_, n) => [
      postTransfer(
        t,
        ana,
        {
          fromAccountId: ana.principal.id,
          destination: { type: 'BENEFICIARY', beneficiaryId: toLuis },
          amount: '70.00',
          concept: 'Manual',
          reference: `${n}`,
        },
        randomUUID(),
      ),
      postTransfer(
        t,
        ana,
        {
          fromAccountId: ana.principal.id,
          destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
          amount: '30.00',
          concept: 'Manual propia',
          reference: `${n}`,
        },
        randomUUID(),
      ),
      postTransfer(
        t,
        luis,
        {
          fromAccountId: luis.principal.id,
          destination: { type: 'BENEFICIARY', beneficiaryId: toAna },
          amount: '40.00',
          concept: 'Cruzada',
          reference: `${n}`,
        },
        randomUUID(),
      ),
    ]).flat();
    const [responses, pass] = await Promise.all([
      Promise.all(manual),
      t.container.scheduler.runner.runOnce(),
    ]);

    expect(responses.map((res) => res.status).filter((status) => status >= 500)).toEqual([]);
    expect(pass.completed + pass.failed).toBe(20);
    for (const row of await executionReport(scheduled)) {
      expect(row.executions, row.id).toBe(1);
      expect(row.entries, row.id).toBe(row.status === 'COMPLETED' ? 2 : 0);
    }
    expect(t.logs.text()).not.toContain('40P01');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
