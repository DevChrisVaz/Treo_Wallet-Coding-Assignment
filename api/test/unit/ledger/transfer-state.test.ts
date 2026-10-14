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

const finals: StoredTransferStatus[] = ['COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'];
const events: TransferEvent[] = [
  'COMPLETE_IMMEDIATELY',
  'REJECT',
  'REQUIRE_OTP',
  'CONFIRM',
  'FAIL_REVALIDATION',
  'EXHAUST_OTP',
  'SCHEDULE',
  'EXECUTE_OK',
  'EXECUTE_FAIL',
  'CANCEL',
];

/** Transiciones de las programadas (D2 de scheduled-transfers). */
const scheduledValid: [StoredTransferStatus | null, TransferEvent, StoredTransferStatus][] = [
  [null, 'SCHEDULE', 'SCHEDULED'],
  ['PENDING_OTP', 'SCHEDULE', 'SCHEDULED'],
  ['SCHEDULED', 'EXECUTE_OK', 'COMPLETED'],
  ['SCHEDULED', 'EXECUTE_FAIL', 'FAILED'],
  ['SCHEDULED', 'CANCEL', 'CANCELLED'],
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

describe('TRF-34 máquina de estados de las programadas', () => {
  it.each(scheduledValid)('TRF-34 %s + %s → %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to);
  });

  it.each([null, 'PENDING_OTP', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED'] as const)(
    'TRF-32 solo una SCHEDULED se cancela: %s + CANCEL es inválida',
    (from) => {
      expect(() => transition(from, 'CANCEL')).toThrow(InvalidTransferTransition);
    },
  );

  it.each(
    (['EXECUTE_OK', 'EXECUTE_FAIL'] as const).flatMap((event) =>
      ([null, 'PENDING_OTP'] as const).map((from) => [from, event] as const),
    ),
  )('TRF-30 solo se ejecuta una SCHEDULED: %s + %s es inválida', (from, event) => {
    expect(() => transition(from, event)).toThrow(InvalidTransferTransition);
  });

  it.each(
    events
      .filter((event) => !['EXECUTE_OK', 'EXECUTE_FAIL', 'CANCEL'].includes(event))
      .map((event) => [event] as const),
  )('TRF-30 una SCHEDULED no admite %s: solo se ejecuta o se cancela', (event) => {
    expect(() => transition('SCHEDULED', event)).toThrow(InvalidTransferTransition);
  });

  it.each(['CONFIRM', 'FAIL_REVALIDATION'] as const)(
    'TRF-28 una programada confirmada no mueve dinero: una SCHEDULED no admite %s',
    (event) => {
      expect(() => transition('SCHEDULED', event)).toThrow(InvalidTransferTransition);
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

  it.each([...finals, 'SCHEDULED'] as const)(
    'TRF-19 un estado final o SCHEDULED (%s) nunca se informa como vencido',
    (status) => {
      expect(effectiveStatus({ status, otpExpiresAt }, new Date('2027-01-01T00:00:00Z'))).toBe(
        status,
      );
    },
  );
});
