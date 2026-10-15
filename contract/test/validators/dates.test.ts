import { describe, expect, it } from 'vitest';
import { mexicoCityDate, schedulableWindow, schedulableDates, parseInstant } from '../../src/index';

describe('mexicoCityDate', () => {
  it('CTR-18 devuelve la fecha de la Ciudad de México de un instante de noche', () => {
    expect(mexicoCityDate(new Date('2026-10-01T05:30:00Z'))).toBe('2026-09-30');
  });

  it('CTR-18 a partir de las 00:00 locales ya es el día siguiente', () => {
    expect(mexicoCityDate(new Date('2026-10-01T05:59:59Z'))).toBe('2026-09-30');
    expect(mexicoCityDate(new Date('2026-10-01T06:00:00Z'))).toBe('2026-10-01');
  });

  it('CTR-18 respeta el horario de verano que tenía la Ciudad de México antes de 2023', () => {
    // 2022-07-01 05:30Z = 00:30 CDT (UTC-5): ya era 1 de julio.
    expect(mexicoCityDate(new Date('2022-07-01T05:30:00Z'))).toBe('2022-07-01');
  });
});

describe('schedulableWindow', () => {
  const now = new Date('2026-10-14T18:00:00Z');

  it('TRF-27 va de 10 minutos a 90 días después del instante, ambos inclusive', () => {
    expect(schedulableWindow(now)).toEqual({
      min: new Date('2026-10-14T18:10:00Z'),
      max: new Date('2027-01-12T18:00:00Z'),
    });
  });

  it('TRF-27 schedulableDates da las fechas de la Ciudad de México que contienen la ventana', () => {
    expect(schedulableDates(now)).toEqual({ min: '2026-10-14', max: '2027-01-12' });
  });

  it('TRF-27 pasada la medianoche local el mínimo ya es el día siguiente', () => {
    // 2026-10-15 05:55Z = 23:55 del 14 en CDMX; +10 min = 00:05 del 15.
    expect(schedulableDates(new Date('2026-10-15T05:55:00Z')).min).toBe('2026-10-15');
  });

  it('TRF-27 usa el día local, no el de UTC', () => {
    // 2026-12-31 23:00Z = 17:00 del 31 en CDMX.
    expect(schedulableDates(new Date('2026-12-31T23:00:00Z')).min).toBe('2026-12-31');
  });
});

describe('parseInstant', () => {
  it('TRF-27 interpreta RFC 3339 con Z y con desfase', () => {
    expect(parseInstant('2026-10-20T14:30:00-06:00')).toEqual(new Date('2026-10-20T20:30:00Z'));
    expect(parseInstant('2026-10-20T20:30:00.000Z')).toEqual(new Date('2026-10-20T20:30:00Z'));
  });

  it.each([
    '2026-10-20',
    '2026-10-20T20:30:00',
    '2026-02-30T10:00:00Z',
    '2026-10-20T25:00:00Z',
    '',
  ])('TRF-27 rechaza %s', (value) => {
    expect(parseInstant(value)).toBeNull();
  });
});
