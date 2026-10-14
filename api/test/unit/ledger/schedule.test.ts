import { describe, expect, it } from 'vitest';
import {
  scheduledAmountIssue,
  scheduledDateIssue,
  schedulableRange,
} from '../../../src/modules/transfers/domain/schedule.js';
import { Money } from '../../../src/shared/money.js';
import { FakeClock } from '../../helpers/fake-clock.js';

const LIMIT = Money.parse('50000.00');

describe('TRF-27 rango programable en días de la Ciudad de México', () => {
  it('TRF-27 el 14 de octubre de 2026 se programa del 15 de octubre al 12 de enero de 2027', () => {
    const clock = new FakeClock('2026-10-14T18:00:00.000Z'); // 12:00 de CDMX
    expect(schedulableRange(clock)).toEqual({ min: '2026-10-15', max: '2027-01-12' });
  });

  it('TRF-27 el día sale de CDMX, no de UTC: a las 21:00 del 14 en CDMX (03:00 UTC del 15) mañana es el 15', () => {
    const clock = new FakeClock('2026-10-15T03:00:00.000Z');
    expect(schedulableRange(clock).min).toBe('2026-10-15');
  });

  it('TRF-27 a las 00:00 del 15 en CDMX el rango ya empieza el 16', () => {
    const clock = new FakeClock('2026-10-14T05:59:59.999Z');
    expect(schedulableRange(clock).min).toBe('2026-10-14');
    clock.set('2026-10-15T06:00:00.000Z');
    expect(schedulableRange(clock).min).toBe('2026-10-16');
  });

  it.each([
    ['hoy', '2026-10-14'],
    ['ayer', '2026-10-13'],
    ['91 días después', '2027-01-13'],
  ])('TRF-27 %s (%s) está fuera de rango con DATE_OUT_OF_RANGE en /scheduledFor', (_case, day) => {
    const clock = new FakeClock('2026-10-14T18:00:00.000Z');
    expect(scheduledDateIssue(day, clock)).toEqual({
      pointer: '/scheduledFor',
      code: 'DATE_OUT_OF_RANGE',
      message: expect.any(String),
    });
  });

  it.each([
    ['mañana', '2026-10-15'],
    ['90 días después', '2027-01-12'],
    ['un día intermedio', '2026-12-01'],
  ])('TRF-27 %s (%s) está dentro del rango', (_case, day) => {
    const clock = new FakeClock('2026-10-14T18:00:00.000Z');
    expect(scheduledDateIssue(day, clock)).toBeNull();
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
