import { describe, expect, it } from 'vitest';
import { transferFingerprint } from '../../../src/modules/transfers/domain/fingerprint.js';
import { Money } from '../../../src/shared/money.js';

const base = {
  fromAccountId: '11111111-1111-4111-8111-111111111111',
  destination: { type: 'BENEFICIARY' as const, id: '22222222-2222-4222-8222-222222222222' },
  concept: 'Renta',
  reference: '1234567',
};

describe('TRF-04 fingerprint del contenido interpretado', () => {
  it('TRF-04 es un SHA-256 hexadecimal', () => {
    expect(transferFingerprint({ ...base, amount: Money.parse('100.00') })).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it('TRF-04 "100.5" y "100.50" producen el mismo fingerprint', () => {
    expect(transferFingerprint({ ...base, amount: Money.parse('100.5') })).toBe(
      transferFingerprint({ ...base, amount: Money.parse('100.50') }),
    );
  });

  it('TRF-04 un monto distinto produce otro fingerprint', () => {
    expect(transferFingerprint({ ...base, amount: Money.parse('100.00') })).not.toBe(
      transferFingerprint({ ...base, amount: Money.parse('200.00') }),
    );
  });

  it.each([
    ['otra cuenta de origen', { fromAccountId: '33333333-3333-4333-8333-333333333333' }],
    [
      'otro tipo de destino',
      { destination: { type: 'OWN_ACCOUNT' as const, id: base.destination.id } },
    ],
    ['otro destino', { destination: { type: 'BENEFICIARY' as const, id: base.fromAccountId } }],
    ['otro concepto', { concept: 'Luz' }],
    ['otra referencia', { reference: '7654321' }],
  ])('TRF-04 cambia con %s', (_case, change) => {
    const amount = Money.parse('100.00');
    expect(transferFingerprint({ ...base, ...change, amount })).not.toBe(
      transferFingerprint({ ...base, amount }),
    );
  });

  it('TRF-04 la serialización no es ambigua aunque el concepto traiga separadores', () => {
    const amount = Money.parse('1.00');
    expect(transferFingerprint({ ...base, concept: 'a|1', reference: '2', amount })).not.toBe(
      transferFingerprint({ ...base, concept: 'a', reference: '12', amount }),
    );
  });
});

describe('TRF-29 la fecha programada en la huella', () => {
  /** Vector tomado del código anterior a scheduled-transfers (commit f912d00): no puede cambiar. */
  const immediate = {
    fromAccountId: '11111111-1111-4111-8111-111111111111',
    destination: { type: 'BENEFICIARY' as const, id: '22222222-2222-4222-8222-222222222222' },
    amount: Money.parse('1250.50'),
    concept: 'Renta de octubre',
    reference: '1234567',
  };
  const PINNED = '99cb4c87a8533b7979dd67cb16d3584138b24efdbda00ce8f4398d99ffd6510c';

  it('TRF-29 la huella de una transferencia inmediata no cambia', () => {
    expect(transferFingerprint(immediate)).toBe(PINNED);
    expect(transferFingerprint({ ...immediate, scheduledFor: null })).toBe(PINNED);
  });

  it('TRF-29 una programada nunca coincide con la inmediata del mismo contenido', () => {
    expect(transferFingerprint({ ...immediate, scheduledFor: '2026-10-15' })).not.toBe(PINNED);
  });

  it('TRF-29 otra fecha produce otra huella y la misma fecha la misma', () => {
    const first = transferFingerprint({ ...immediate, scheduledFor: '2026-10-15' });
    expect(transferFingerprint({ ...immediate, scheduledFor: '2026-10-15' })).toBe(first);
    expect(transferFingerprint({ ...immediate, scheduledFor: '2026-10-16' })).not.toBe(first);
  });
});
