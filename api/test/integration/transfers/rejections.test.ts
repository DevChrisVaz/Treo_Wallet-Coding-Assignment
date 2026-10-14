import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared/money.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  balanceOf,
  fund,
  ledgerUser,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

function send(amount: string, key = randomUUID()) {
  return t.container.transfers.createTransfer.execute(ana.userId, key, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', id: beneficiaryId },
    amount: Money.parse(amount),
    concept: 'Renta',
    reference: 1234567,
  });
}

describe('TRF-10 rechazo por saldo insuficiente', () => {
  it('TRF-10 guarda la transferencia REJECTED sin asientos, responde 422 con transferId y audita', async () => {
    await fund(t, ana.principal.id, '100.00');
    const outcome = await send('150.00');
    expect(outcome.kind).toBe('REJECTED');
    if (outcome.kind !== 'REJECTED') return;
    expect(outcome.error.code).toBe('INSUFFICIENT_FUNDS');
    const transferId = outcome.error.extensions.transferId;
    expect(transferId).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await harness.migrator.query(
      'SELECT status, rejection_reason, completed_at FROM app.transfers WHERE id = $1',
      [transferId],
    );
    expect(row).toEqual({
      status: 'REJECTED',
      rejection_reason: 'INSUFFICIENT_FUNDS',
      completed_at: null,
    });
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.ledger_entries WHERE transfer_id = $1',
      [transferId],
    );
    expect(n).toBe(0);
    expect(await balanceOf(harness, ana.principal.id)).toBe('100.00');
    const events = (await auditEvents(harness.migrator)).filter((e) => e.entity_id === transferId);
    expect(events).toMatchObject([
      { action: 'TRANSFER_CREATED', metadata: { status: 'REJECTED', amount: '150.00' } },
      { action: 'TRANSFER_REJECTED', metadata: { reason: 'INSUFFICIENT_FUNDS', amount: '150.00' } },
    ]);
  });

  it('TRF-03 el reintento después de fondear repite el mismo 422 con el mismo transferId', async () => {
    await fund(t, ana.principal.id, '100.00');
    const key = randomUUID();
    const first = await send('150.00', key);
    await fund(t, ana.principal.id, '1000.00');
    const again = await send('150.00', key);
    expect(again).toMatchObject({ kind: 'REJECTED', replayed: true });
    if (first.kind !== 'REJECTED' || again.kind !== 'REJECTED') return;
    expect(again.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(again.error.extensions.transferId).toBe(first.error.extensions.transferId);
    expect(await balanceOf(harness, ana.principal.id)).toBe('1100.00');
  });
});

describe('TRF-11 rechazo por límite diario', () => {
  it('TRF-11 con 45000.00 usados, enviar 6000.00 es DAILY_LIMIT_EXCEEDED con remaining 5000.00', async () => {
    await fund(t, ana.principal.id, '10000.00');
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-13', 4500000, 5000000)`,
      [ana.userId],
    );
    const outcome = await send('6000.00');
    expect(outcome.kind).toBe('REJECTED');
    if (outcome.kind !== 'REJECTED') return;
    expect(outcome.error.code).toBe('DAILY_LIMIT_EXCEEDED');
    expect(outcome.error.extensions.remaining).toBe('5000.00');
    const [usage] = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage.used_cents).toBe('4500000');
  });
});
