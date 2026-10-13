import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TIME_ZONE,
  businessDayOf,
  nextBusinessDayStart,
  utcRangeOfDays,
} from '../../../src/shared/business-day.js';

describe('TRF-12 día de negocio en America/Mexico_City', () => {
  it('TRF-12 la zona horaria de negocio es la de la Ciudad de México', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Mexico_City');
  });

  it.each([
    ['17:59 CDMX', '2026-10-13T23:59:00.000Z', '2026-10-13'],
    ['18:00 CDMX (medianoche UTC)', '2026-10-14T00:00:00.000Z', '2026-10-13'],
    ['23:59 CDMX', '2026-10-14T05:59:00.000Z', '2026-10-13'],
    ['00:00 CDMX', '2026-10-14T06:00:00.000Z', '2026-10-14'],
  ])('TRF-12 a las %s el día es el de CDMX', (_case, instant, day) => {
    expect(businessDayOf(new Date(instant))).toBe(day);
  });

  it('ACC-11 el límite se reinicia en la siguiente medianoche de CDMX expresada en UTC', () => {
    expect(nextBusinessDayStart(new Date('2026-10-13T23:00:00.000Z')).toISOString()).toBe(
      '2026-10-14T06:00:00.000Z',
    );
    expect(nextBusinessDayStart(new Date('2026-10-14T05:59:59.999Z')).toISOString()).toBe(
      '2026-10-14T06:00:00.000Z',
    );
    expect(nextBusinessDayStart(new Date('2026-10-14T06:00:00.000Z')).toISOString()).toBe(
      '2026-10-15T06:00:00.000Z',
    );
  });

  it('HIS-06 un rango de días inclusivo se convierte a [desde 00:00, hasta + 1 00:00) en UTC', () => {
    const range = utcRangeOfDays('2026-09-30', '2026-09-30');
    expect(range.start.toISOString()).toBe('2026-09-30T06:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    // 23:30 del 30 de septiembre en CDMX = 05:30 UTC del 1 de octubre: queda dentro.
    const lateNight = new Date('2026-10-01T05:30:00.000Z').getTime();
    expect(lateNight >= range.start.getTime() && lateNight < range.endExclusive.getTime()).toBe(
      true,
    );
  });

  it('HIS-06 un rango de varios días cruza fines de mes', () => {
    const range = utcRangeOfDays('2026-01-30', '2026-02-02');
    expect(range.start.toISOString()).toBe('2026-01-30T06:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-02-03T06:00:00.000Z');
  });
});
