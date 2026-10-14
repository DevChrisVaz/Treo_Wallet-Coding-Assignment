import { describe, expect, it } from 'vitest';
import {
  StatementPeriod,
  StatementPeriodError,
} from '../../../src/modules/statements/domain/statement-period.js';
import { FakeClock } from '../../helpers/fake-clock.js';

// 14 de octubre de 2026, 12:00 en la Ciudad de México.
const OCT_14_NOON = '2026-10-14T18:00:00.000Z';

function parse(value: string, now = OCT_14_NOON) {
  return StatementPeriod.parse(value, new FakeClock(now));
}

function failure(value: string, now = OCT_14_NOON): StatementPeriodError {
  try {
    parse(value, now);
  } catch (error) {
    if (error instanceof StatementPeriodError) return error;
    throw error;
  }
  throw new Error(`El periodo ${value} no falló`);
}

describe('HIS-11 periodo del estado de cuenta', () => {
  it('HIS-11 un mes cerrado va de la medianoche de CDMX del día 1 a la del día 1 del mes siguiente', () => {
    const period = parse('2026-09');
    expect(period.value).toBe('2026-09');
    expect(period.start.toISOString()).toBe('2026-09-01T06:00:00.000Z');
    expect(period.endExclusive.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(period.partial).toBe(false);
    expect(period.firstDay).toBe('2026-09-01');
    expect(period.lastDay).toBe('2026-09-30');
  });

  it('HIS-11 el mes en curso es parcial: cubre del día 1 hasta el instante de generación, inclusive', () => {
    const period = parse('2026-10');
    expect(period.partial).toBe(true);
    expect(period.start.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(period.generatedAt.toISOString()).toBe(OCT_14_NOON);
    // Los asientos llevan la hora del Clock (milisegundos): uno del mismo instante queda dentro.
    expect(period.endExclusive.toISOString()).toBe('2026-10-14T18:00:00.001Z');
    expect(period.firstDay).toBe('2026-10-01');
    expect(period.lastDay).toBe('2026-10-14');
  });

  it('HIS-11 lee el reloj una sola vez: la hora de generación es la del Clock', () => {
    const clock = new FakeClock(OCT_14_NOON);
    clock.queue(OCT_14_NOON, '2026-10-14T18:05:00.000Z');
    const period = StatementPeriod.parse('2026-09', clock);
    expect(period.generatedAt.toISOString()).toBe(OCT_14_NOON);
    expect(clock.now().toISOString()).toBe('2026-10-14T18:05:00.000Z');
  });

  it('HIS-11 un mes posterior al mes en curso de CDMX es DATE_OUT_OF_RANGE', () => {
    expect(failure('2026-11')).toMatchObject({ code: 'DATE_OUT_OF_RANGE' });
    expect(failure('2027-01')).toMatchObject({ code: 'DATE_OUT_OF_RANGE' });
  });

  it('HIS-11 el mes en curso es el de CDMX: a las 23:30 del 30 de septiembre, octubre todavía es futuro', () => {
    const lateNight = '2026-10-01T05:30:00.000Z';
    expect(failure('2026-10', lateNight)).toMatchObject({ code: 'DATE_OUT_OF_RANGE' });
    const september = parse('2026-09', lateNight);
    expect(september.partial).toBe(true);
    expect(september.lastDay).toBe('2026-09-30');
  });

  it('HIS-11 a la medianoche de CDMX del día 1 el mes nuevo ya es el mes en curso', () => {
    const midnight = '2026-11-01T06:00:00.000Z';
    const november = parse('2026-11', midnight);
    expect(november.partial).toBe(true);
    expect(november.firstDay).toBe('2026-11-01');
    expect(november.lastDay).toBe('2026-11-01');
    expect(parse('2026-10', midnight).partial).toBe(false);
  });

  it.each([
    ['mes 13', '2026-13'],
    ['mes 00', '2026-00'],
    ['mes de un dígito', '2026-9'],
    ['año fuera de 2000 a 2099', '1999-12'],
    ['año 2100', '2100-01'],
    ['fecha completa', '2026-09-01'],
    ['separador distinto', '2026/09'],
    ['vacío', ''],
    ['espacios', ' 2026-09'],
  ])('HIS-11 un periodo con %s es INVALID_FORMAT', (_case, value) => {
    expect(failure(value)).toMatchObject({ code: 'INVALID_FORMAT' });
  });

  it('HIS-11 no hay límite inferior aparte del patrón: enero de 2000 es válido', () => {
    const period = parse('2000-01');
    expect(period.partial).toBe(false);
    expect(period.start.toISOString()).toBe('2000-01-01T06:00:00.000Z');
    expect(period.endExclusive.toISOString()).toBe('2000-02-01T06:00:00.000Z');
  });

  it('HIS-12 diciembre termina en la medianoche de CDMX del 1 de enero siguiente', () => {
    const period = parse('2025-12');
    expect(period.endExclusive.toISOString()).toBe('2026-01-01T06:00:00.000Z');
    expect(period.lastDay).toBe('2025-12-31');
  });

  it('HIS-12 febrero de un año bisiesto termina el 29', () => {
    expect(parse('2024-02').lastDay).toBe('2024-02-29');
    expect(parse('2025-02').lastDay).toBe('2025-02-28');
  });

  it('HIS-12 con horario de verano (antes de 2023) usa el desfase vigente según la base IANA', () => {
    // Julio de 2022: CDMX en horario de verano (UTC-5).
    const july = parse('2022-07');
    expect(july.start.toISOString()).toBe('2022-07-01T05:00:00.000Z');
    expect(july.endExclusive.toISOString()).toBe('2022-08-01T05:00:00.000Z');
    // Octubre de 2022: empieza en verano y el horario de verano terminó el 30 de octubre.
    const october = parse('2022-10');
    expect(october.start.toISOString()).toBe('2022-10-01T05:00:00.000Z');
    expect(october.endExclusive.toISOString()).toBe('2022-11-01T06:00:00.000Z');
  });
});
