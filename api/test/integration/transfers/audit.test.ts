import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
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
let luis: LedgerUser;
let beneficiaryId: string;
/** Acción de auditoría cuya escritura se hace fallar (`null`: ninguna). */
let failOn: string | null;

beforeEach(async () => {
  failOn = null;
  const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
  const audit: AuditWriter = {
    record: async (tx, event) => {
      if (event.action === failOn) throw new Error('falla forzada de auditoría');
      return real.record(tx, event);
    },
    recordStandalone: (event) => real.recordStandalone(event),
  };
  t = await buildTestApp(harness, { overrides: { audit } });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez Gómez',
    alias: 'Luis de la oficina',
    clabe: luis.principal.clabe,
  });
});

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta de octubre',
  reference: '1234567',
});

async function transferEvents(transferId: string) {
  return (await auditEvents(harness.migrator)).filter((event) => event.entity_id === transferId);
}

async function countOf(table: 'transfers' | 'ledger_entries' | 'daily_transfer_usage') {
  const [{ n }] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.${table}
      ${table === 'transfers' ? `WHERE kind <> 'FUNDING'` : ''}
      ${table === 'ledger_entries' ? `WHERE transfer_id IN (SELECT id FROM app.transfers WHERE kind <> 'FUNDING')` : ''}`,
  );
  return n;
}

describe('TRF-25 eventos de auditoría de una transferencia', () => {
  it('TRF-25 una transferencia completada deja TRANSFER_CREATED y TRANSFER_COMPLETED con su id y monto', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, toLuis('1250.50'));
    expect(res.status).toBe(201);
    const events = await transferEvents(res.body.id);
    expect(events).toEqual([
      expect.objectContaining({
        action: 'TRANSFER_CREATED',
        actor_type: 'USER',
        actor_user_id: ana.userId,
        entity_type: 'transfer',
        entity_id: res.body.id,
        request_id: expect.any(String),
        metadata: { status: 'COMPLETED', kind: 'THIRD_PARTY', amount: '1250.50' },
      }),
      expect.objectContaining({
        action: 'TRANSFER_COMPLETED',
        actor_user_id: ana.userId,
        entity_id: res.body.id,
        metadata: { kind: 'THIRD_PARTY', amount: '1250.50' },
      }),
    ]);
  });

  it('TRF-25 los eventos no contienen datos personales de quien envía ni del destino', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, toLuis('100.00'));
    expect(res.status).toBe(201);
    const events = await transferEvents(res.body.id);
    expect(events).toHaveLength(2);
    expect(
      leakedValues(events, [
        ana.person.email,
        ana.person.fullName,
        ana.person.curp,
        ana.person.rfc,
        ana.person.phone,
        luis.person.email,
        luis.person.fullName,
        luis.principal.clabe,
        ana.principal.clabe,
        'Luis Pérez Gómez',
        'Luis de la oficina',
        'Renta de octubre',
      ]),
    ).toEqual([]);
  });
});

describe('TRF-25 la operación se revierte si la auditoría falla', () => {
  it('TRF-25 si falla TRANSFER_COMPLETED no queda transferencia, asientos, saldo ni límite consumido, y la llave sigue libre', async () => {
    await fund(t, ana.principal.id, '5000.00');
    failOn = 'TRANSFER_COMPLETED';
    const key = randomUUID();
    const res = await postTransfer(t, ana, toLuis('1250.50'), key);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(await countOf('transfers')).toBe(0);
    expect(await countOf('ledger_entries')).toBe(0);
    expect(await countOf('daily_transfer_usage')).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('0.00');
    expect(
      (await auditEvents(harness.migrator)).filter((e) => e.action.startsWith('TRANSFER_')),
    ).toEqual([]);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);

    failOn = null;
    const retry = await postTransfer(t, ana, toLuis('1250.50'), key);
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
    expect(await balanceOf(harness, ana.principal.id)).toBe('3749.50');
  });

  it('TRF-25 si falla TRANSFER_REJECTED no queda la transferencia rechazada', async () => {
    await fund(t, ana.principal.id, '100.00');
    failOn = 'TRANSFER_REJECTED';
    const res = await postTransfer(t, ana, toLuis('150.00'));
    expect(res.status).toBe(500);
    expect(await countOf('transfers')).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('100.00');
  });
});
