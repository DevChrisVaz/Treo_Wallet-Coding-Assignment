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

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let beneficiaryId: string;
/** Transferencias cuya auditoría de ejecución se hace fallar. */
let failFor: Set<string>;

beforeEach(async () => {
  failFor = new Set();
  const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
  const audit: AuditWriter = {
    record: async (tx, event) => {
      if (
        event.entity !== undefined &&
        failFor.has(event.entity.id) &&
        (event.action === 'TRANSFER_COMPLETED' || event.action === 'TRANSFER_FAILED')
      ) {
        throw new Error('falla forzada de auditoría');
      }
      return real.record(tx, event);
    },
    recordStandalone: (event) => real.recordStandalone(event),
  };
  // Lotes de 2: cuatro candidatas son dos lotes llenos y un tercero vacío.
  t = await buildTestApp(harness, {
    now: '2026-10-14T18:00:00.000Z',
    config: { scheduler: { enabled: false, intervalMs: 60_000, batchSize: 2 } },
    overrides: { audit },
  });
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
    scheduledFor: '2026-10-15T06:00:00.000Z',
  });
  expect(res.status).toBe(201);
  t.clock.advance(1_000);
  return res.body.id as string;
}

async function statusOf(id: string): Promise<string> {
  const [row] = await harness.migrator.query(`SELECT status FROM app.transfers WHERE id = $1`, [
    id,
  ]);
  return row.status;
}

describe('TRF-30 y TRF-31 un lote entero que no se ejecuta', () => {
  it('TRF-31 si todo un lote falla por saldo, la pasada sigue con las siguientes y cada fallida se procesa una vez', async () => {
    await fund(t, ana.principal.id, '300.00');
    // Las dos primeras no alcanzan; las dos siguientes sí.
    const failing = [await schedule('1000.00', '1'), await schedule('2000.00', '2')];
    const passing = [await schedule('100.00', '3'), await schedule('100.00', '4')];
    t.clock.set('2026-10-15T06:00:30.000Z');
    t.mailer.clear();

    const pass = await t.container.scheduler.runner.runOnce();

    expect(pass).toEqual({ completed: 2, failed: 2, skipped: 0, errors: 0 });
    for (const id of failing) expect(await statusOf(id)).toBe('FAILED');
    for (const id of passing) expect(await statusOf(id)).toBe('COMPLETED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('100.00');
    const events = await auditEvents(harness.migrator);
    for (const id of failing) {
      const failures = events.filter(
        (event) => event.entity_id === id && event.action === 'TRANSFER_FAILED',
      );
      expect(failures).toHaveLength(1);
    }
    // Un aviso de falla por cada fallida (los comprobantes de las completadas son TRF-38).
    await t.container.notices.drain(2_000);
    const failureNotices = t.mailer
      .to(ana.person.email)
      .filter((mail) => mail.subject === 'Tu transferencia programada no se realizó');
    expect(failureNotices).toHaveLength(2);
  });

  it('TRF-36 si todo un lote se revierte y sigue SCHEDULED, la pasada termina, ejecuta las siguientes y no repite las revertidas', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const broken = [await schedule('100.00', '1'), await schedule('100.00', '2')];
    const healthy = [await schedule('100.00', '3'), await schedule('100.00', '4')];
    t.clock.set('2026-10-15T06:00:30.000Z');
    for (const id of broken) failFor.add(id);

    // Sin continuar después de la última candidata, el primer lote se leería otra vez sin fin.
    const pass = await t.container.scheduler.runner.runOnce();

    expect(pass).toEqual({ completed: 2, failed: 0, skipped: 0, errors: 2 });
    for (const id of broken) expect(await statusOf(id)).toBe('SCHEDULED');
    for (const id of healthy) expect(await statusOf(id)).toBe('COMPLETED');
    const logged = t.logs
      .entries()
      .filter((entry) => entry.msg === 'scheduled transfer execution failed');
    expect(logged.map((entry) => entry.transferId).sort()).toEqual([...broken].sort());
  });
});
