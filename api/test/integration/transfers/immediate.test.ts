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
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

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
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '5000.00');
});

describe('TRF-01 ejecución inmediata hasta el umbral', () => {
  it('TRF-01 una transferencia a un beneficiario se completa, mueve el saldo y consume el límite', async () => {
    const outcome = await t.container.transfers.createTransfer.execute(ana.userId, randomUUID(), {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', id: beneficiaryId },
      amount: Money.parse('1250.5'),
      concept: 'Renta',
      reference: 1234567,
    });
    expect(outcome.kind).toBe('CREATED');
    if (outcome.kind !== 'CREATED') return;
    expect(outcome.transfer).toMatchObject({
      status: 'COMPLETED',
      kind: 'THIRD_PARTY',
      amount: '1250.50',
      reference: '1234567',
      requiresOtp: false,
      otp: null,
      completedAt: '2026-10-13T18:00:00.000Z',
      destination: {
        type: 'BENEFICIARY',
        beneficiaryId,
        accountId: null,
        displayName: 'Luis',
        clabeLast4: luis.principal.clabe.slice(-4),
      },
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('3749.50');
    expect(await balanceOf(harness, luis.principal.id)).toBe('1250.50');
    const [usage] = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage.used_cents).toBe('125050');
    const events = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === outcome.transfer.id,
    );
    expect(events.map((event) => event.action)).toEqual(['TRANSFER_CREATED', 'TRANSFER_COMPLETED']);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-01 una transferencia entre cuentas propias es OWN y no consume el límite', async () => {
    const outcome = await t.container.transfers.createTransfer.execute(ana.userId, randomUUID(), {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', id: ana.ahorro.id },
      amount: Money.parse('500.00'),
      concept: 'Ahorro',
      reference: 1,
    });
    expect(outcome).toMatchObject({
      kind: 'CREATED',
      transfer: { kind: 'OWN', status: 'COMPLETED', destination: { displayName: 'Ahorro' } },
    });
    expect(await balanceOf(harness, ana.ahorro.id)).toBe('500.00');
    const usage = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage).toEqual([]);
  });
});
