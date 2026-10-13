import { describe, expect, it } from 'vitest';
import {
  effectiveStatus,
  InvalidTransferTransition,
  transition,
  type StoredTransferStatus,
  type TransferEvent,
} from '../../../src/modules/transfers/domain/transfer-status.js';

const valid: [StoredTransferStatus | null, TransferEvent, StoredTransferStatus][] = [
  [null, 'COMPLETE_IMMEDIATELY', 'COMPLETED'],
  [null, 'REJECT', 'REJECTED'],
  [null, 'REQUIRE_OTP', 'PENDING_OTP'],
  ['PENDING_OTP', 'CONFIRM', 'COMPLETED'],
  ['PENDING_OTP', 'FAIL_REVALIDATION', 'FAILED'],
  ['PENDING_OTP', 'EXHAUST_OTP', 'FAILED'],
];

const finals: StoredTransferStatus[] = ['COMPLETED', 'REJECTED', 'FAILED'];
const events: TransferEvent[] = [
  'COMPLETE_IMMEDIATELY',
  'REJECT',
  'REQUIRE_OTP',
  'CONFIRM',
  'FAIL_REVALIDATION',
  'EXHAUST_OTP',
];

describe('TRF-14 máquina de estados de la transferencia', () => {
  it.each(valid)('TRF-14 %s + %s → %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to);
  });

  it.each(finals.flatMap((state) => events.map((event) => [state, event] as const)))(
    'TRF-18 un estado final no admite transiciones: %s + %s',
    (state, event) => {
      expect(() => transition(state, event)).toThrow(InvalidTransferTransition);
    },
  );

  it.each(['CONFIRM', 'FAIL_REVALIDATION', 'EXHAUST_OTP'] as const)(
    'TRF-16 sin transferencia previa no se puede %s',
    (event) => {
      expect(() => transition(null, event)).toThrow(InvalidTransferTransition);
    },
  );

  it.each(['COMPLETE_IMMEDIATELY', 'REJECT', 'REQUIRE_OTP'] as const)(
    'TRF-17 una transferencia pendiente no se vuelve a crear con %s',
    (event) => {
      expect(() => transition('PENDING_OTP', event)).toThrow(InvalidTransferTransition);
    },
  );
});

describe('TRF-19 vencimiento calculado', () => {
  const otpExpiresAt = new Date('2026-10-13T18:05:00.000Z');

  it('TRF-19 una pendiente se informa EXPIRED desde su vencimiento, sin proceso en segundo plano', () => {
    const pending = { status: 'PENDING_OTP' as const, otpExpiresAt };
    expect(effectiveStatus(pending, new Date('2026-10-13T18:04:59.999Z'))).toBe('PENDING_OTP');
    expect(effectiveStatus(pending, new Date('2026-10-13T18:05:00.000Z'))).toBe('EXPIRED');
    expect(effectiveStatus(pending, new Date('2026-10-13T18:06:00.000Z'))).toBe('EXPIRED');
  });

  it.each(finals)('TRF-19 un estado final (%s) nunca se informa como vencido', (status) => {
    expect(effectiveStatus({ status, otpExpiresAt }, new Date('2027-01-01T00:00:00Z'))).toBe(
      status,
    );
  });
});
