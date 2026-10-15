import { describe, expect, it } from 'vitest';
import {
  scheduledAmountIssue,
  scheduledInstantIssue,
} from '../../../src/modules/transfers/domain/schedule.js';
import { Money } from '../../../src/shared/money.js';
import { FakeClock } from '../../helpers/fake-clock.js';

const LIMIT = Money.parse('50000.00');

/** 14-oct-2026 12:00 de CDMX. */
const NOW = '2026-10-14T18:00:00.000Z';
const MINUTE = 60_000;

describe('TRF-27 ventana programable: de 10 minutos a 90 días después de ahora', () => {
  it.each([
    ['9 minutos', 9 * MINUTE],
    ['1 minuto', MINUTE],
    ['ahora mismo', 0],
    ['una hora antes', -60 * MINUTE],
    ['90 días y 1 minuto', 90 * 1_440 * MINUTE + MINUTE],
  ])(
    'TRF-27 %s después de ahora queda fuera con DATE_OUT_OF_RANGE en /scheduledFor',
    (_case, offset) => {
      const clock = new FakeClock(NOW);
      const instant = new Date(clock.now().getTime() + offset);
      expect(scheduledInstantIssue(instant, clock)).toEqual({
        pointer: '/scheduledFor',
        code: 'DATE_OUT_OF_RANGE',
        message: expect.stringContaining('10 minutos y 90 días'),
      });
    },
  );

  it.each([
    ['exactamente 10 minutos', 10 * MINUTE],
    ['11 minutos', 11 * MINUTE],
    ['mañana a la misma hora', 1_440 * MINUTE],
    ['exactamente 90 días', 90 * 1_440 * MINUTE],
  ])('TRF-27 %s después de ahora está dentro de la ventana', (_case, offset) => {
    const clock = new FakeClock(NOW);
    expect(scheduledInstantIssue(new Date(clock.now().getTime() + offset), clock)).toBeNull();
  });

  it('TRF-27 la ventana se mueve con el reloj: 10 minutos después ya no alcanza el mismo instante', () => {
    const clock = new FakeClock(NOW);
    const instant = new Date(clock.now().getTime() + 10 * MINUTE);
    expect(scheduledInstantIssue(instant, clock)).toBeNull();
    clock.set('2026-10-14T18:00:01.000Z');
    expect(scheduledInstantIssue(instant, clock)).not.toBeNull();
  });

  it('TRF-27 el mismo día de CDMX sí se puede programar si pasan 10 minutos (hoy a las 23:00)', () => {
    const clock = new FakeClock(NOW);
    expect(scheduledInstantIssue(new Date('2026-10-15T05:00:00.000Z'), clock)).toBeNull(); // 23:00 CDMX
  });
});

describe('TRF-27 monto programado mayor al límite diario', () => {
  it('TRF-27 a un tercero por más del límite diario es TOO_LARGE en /amount: nunca podría ejecutarse', () => {
    expect(scheduledAmountIssue('THIRD_PARTY', Money.parse('50000.01'), LIMIT)).toEqual({
      pointer: '/amount',
      code: 'TOO_LARGE',
      message: expect.any(String),
    });
  });

  it('TRF-27 a un tercero por exactamente el límite diario se puede programar', () => {
    expect(scheduledAmountIssue('THIRD_PARTY', Money.parse('50000.00'), LIMIT)).toBeNull();
  });

  it('TRF-27 entre cuentas propias el límite diario no aplica', () => {
    expect(scheduledAmountIssue('OWN', Money.parse('80000.00'), LIMIT)).toBeNull();
  });
});
