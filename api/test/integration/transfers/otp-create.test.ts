import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { maskEmail } from '../../../src/shared/masking.js';
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
  await fund(t, ana.principal.id, '20000.00');
});

function send(destination: { type: 'OWN_ACCOUNT' | 'BENEFICIARY'; id: string }, amount: string) {
  return t.container.transfers.createTransfer.execute(ana.userId, randomUUID(), {
    fromAccountId: ana.principal.id,
    destination,
    amount: Money.parse(amount),
    concept: 'Enganche',
    reference: 42,
  });
}

describe('TRF-14 camino con OTP', () => {
  it('TRF-14 15000.00 a un beneficiario queda PENDING_OTP sin asientos, con desafío y saldo intacto', async () => {
    const outcome = await send({ type: 'BENEFICIARY', id: beneficiaryId }, '15000.00');
    expect(outcome.kind).toBe('CREATED');
    if (outcome.kind !== 'CREATED') return;
    const transfer = outcome.transfer;
    expect(transfer).toMatchObject({
      status: 'PENDING_OTP',
      kind: 'THIRD_PARTY',
      amount: '15000.00',
      requiresOtp: true,
      completedAt: null,
      otp: {
        channel: 'EMAIL',
        maskedDestination: maskEmail(ana.person.email),
        expiresAt: '2026-10-13T18:05:00.000Z',
        attemptsRemaining: 3,
        resendsRemaining: 3,
      },
    });

    const [row] = await harness.migrator.query(
      `SELECT status, requires_otp, otp_expires_at, completed_at FROM app.transfers WHERE id = $1`,
      [transfer.id],
    );
    expect(row).toEqual({
      status: 'PENDING_OTP',
      requires_otp: true,
      otp_expires_at: new Date('2026-10-13T18:05:00.000Z'),
      completed_at: null,
    });
    const entries = await harness.migrator.query(
      'SELECT 1 FROM app.ledger_entries WHERE transfer_id = $1',
      [transfer.id],
    );
    expect(entries).toEqual([]);
    const codes = await harness.migrator.query(
      `SELECT purpose, code_hash, attempts, resend_count, expires_at, consumed_at
         FROM app.one_time_codes WHERE subject_id = $1`,
      [transfer.id],
    );
    expect(codes).toEqual([
      {
        purpose: 'TRANSFER_CONFIRMATION',
        code_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        attempts: 0,
        resend_count: 0,
        expires_at: new Date('2026-10-13T18:05:00.000Z'),
        consumed_at: null,
      },
    ]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('20000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('0.00');
    const usage = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage.map((u: { used_cents: string }) => u.used_cents)).toEqual(['0']);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('TRF-25 audita TRANSFER_CREATED con PENDING_OTP y TRANSFER_OTP_SENT, sin el código', async () => {
    const outcome = await send({ type: 'BENEFICIARY', id: beneficiaryId }, '15000.00');
    if (outcome.kind !== 'CREATED') throw new Error('se esperaba CREATED');
    const events = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === outcome.transfer.id,
    );
    expect(events).toEqual([
      expect.objectContaining({
        action: 'TRANSFER_CREATED',
        actor_user_id: ana.userId,
        metadata: { status: 'PENDING_OTP', kind: 'THIRD_PARTY', amount: '15000.00' },
      }),
      expect.objectContaining({
        action: 'TRANSFER_OTP_SENT',
        actor_user_id: ana.userId,
        entity_type: 'transfer',
        metadata: { channel: 'EMAIL', expiresAt: '2026-10-13T18:05:00.000Z' },
      }),
    ]);
  });

  it('TRF-14 12000.00 entre cuentas propias también pide OTP', async () => {
    const outcome = await send({ type: 'OWN_ACCOUNT', id: ana.ahorro.id }, '12000.00');
    expect(outcome).toMatchObject({
      kind: 'CREATED',
      transfer: { status: 'PENDING_OTP', kind: 'OWN', requiresOtp: true },
    });
    expect(await balanceOf(harness, ana.ahorro.id)).toBe('0.00');
  });

  it('TRF-14 con saldo insuficiente se rechaza de inmediato aunque el monto pida OTP', async () => {
    const outcome = await send({ type: 'BENEFICIARY', id: beneficiaryId }, '25000.00');
    expect(outcome.kind).toBe('REJECTED');
    if (outcome.kind !== 'REJECTED') return;
    expect(outcome.error.code).toBe('INSUFFICIENT_FUNDS');
    const codes = await harness.migrator.query(
      'SELECT 1 FROM app.one_time_codes WHERE purpose = $1',
      ['TRANSFER_CONFIRMATION'],
    );
    expect(codes).toEqual([]);
  });
});
