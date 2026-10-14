import { describe, expect, it } from 'vitest';
import {
  formatMexicoCityDate,
  formatMexicoCityDateTime,
  formatMexicoCityDateTimeShort,
  isPeriodBeforeCreation,
  listStatementPeriods,
  mexicoCityDateTime,
  mexicoCityToInstant,
  statementPeriodLabel,
  statementPeriodOf,
} from '../src/index';

describe('mexicoCityToInstant', () => {
  it('TRF-27 combina fecha y hora de la Ciudad de México en un instante UTC', () => {
    expect(mexicoCityToInstant('2026-10-20', '14:30')).toBe('2026-10-20T20:30:00.000Z');
  });

  it('TRF-27 pasa al día siguiente en UTC cuando la hora local es de noche', () => {
    expect(mexicoCityToInstant('2026-10-20', '20:30')).toBe('2026-10-21T02:30:00.000Z');
  });

  it('TRF-27 respeta el horario de verano que tenía México antes de 2023', () => {
    // Julio de 2022 era CDT (UTC-5).
    expect(mexicoCityToInstant('2022-07-01', '14:30')).toBe('2022-07-01T19:30:00.000Z');
  });

  it('TRF-27 usa UTC-6 todo el año desde 2023', () => {
    expect(mexicoCityToInstant('2026-07-01', '14:30')).toBe('2026-07-01T20:30:00.000Z');
    expect(mexicoCityToInstant('2026-01-01', '14:30')).toBe('2026-01-01T20:30:00.000Z');
  });

  it('TRF-27 el resultado vuelve a la misma fecha y hora locales', () => {
    expect(mexicoCityDateTime(mexicoCityToInstant('2026-12-31', '23:59'))).toEqual({
      date: '2026-12-31',
      time: '23:59',
    });
    expect(mexicoCityDateTime(mexicoCityToInstant('2026-10-20', '00:00'))).toEqual({
      date: '2026-10-20',
      time: '00:00',
    });
  });

  it.each([
    ['2026-02-30', '10:00'],
    ['2026-10-20', '24:00'],
    ['2026-10-20', '10:60'],
    ['20-10-2026', '10:00'],
    ['2026-10-20', '9:00'],
    ['', ''],
  ])('TRF-27 rechaza %s %s', (date, time) => {
    expect(() => mexicoCityToInstant(date, time)).toThrow(RangeError);
  });
});

describe('formato de fecha y hora de la Ciudad de México', () => {
  it('TRF-27 formatea la forma larga en español', () => {
    expect(formatMexicoCityDateTime('2026-10-20T20:30:00.000Z')).toBe(
      '20 de octubre de 2026, 14:30',
    );
  });

  it('TRF-27 formatea la forma corta', () => {
    expect(formatMexicoCityDateTimeShort('2026-10-20T20:30:00.000Z')).toBe('20 oct 2026, 14:30');
    expect(formatMexicoCityDateTimeShort(new Date('2027-03-05T15:05:00Z'))).toBe(
      '5 mar 2027, 09:05',
    );
  });

  it('TRF-27 usa el día y la hora locales, no los de UTC', () => {
    expect(formatMexicoCityDateTime('2026-10-21T02:30:00.000Z')).toBe(
      '20 de octubre de 2026, 20:30',
    );
    expect(formatMexicoCityDate('2026-01-01T05:59:00Z')).toBe('31 de diciembre de 2025');
  });

  it('TRF-27 la medianoche local es 00:00, no 24:00', () => {
    expect(mexicoCityDateTime('2026-10-20T06:00:00Z').time).toBe('00:00');
  });

  it('TRF-27 rechaza un instante inválido', () => {
    expect(() => formatMexicoCityDateTime('no es una fecha')).toThrow(RangeError);
  });
});

describe('periodos de estado de cuenta', () => {
  const now = new Date('2026-10-14T18:00:00Z');

  it('HIS-11 va del mes de creación al mes en curso, el más reciente primero', () => {
    expect(listStatementPeriods('2026-07-20T15:00:00Z', now)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
    ]);
  });

  it('HIS-11 una cuenta creada este mes solo tiene el mes en curso', () => {
    expect(listStatementPeriods('2026-10-01T15:00:00Z', now)).toEqual(['2026-10']);
  });

  it('HIS-11 cruza el cambio de año', () => {
    expect(listStatementPeriods('2025-11-15T15:00:00Z', now)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
      '2025-12',
      '2025-11',
    ]);
  });

  it('HIS-11 el mes de creación es el de la Ciudad de México, no el de UTC', () => {
    // 2026-09-01 03:00Z sigue siendo 31 de agosto en la Ciudad de México.
    expect(listStatementPeriods('2026-09-01T03:00:00Z', now)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
    ]);
  });

  it('HIS-11 el mes en curso también se toma en la Ciudad de México', () => {
    // 2026-11-01 04:00Z sigue siendo 31 de octubre en la Ciudad de México.
    expect(listStatementPeriods('2026-10-05T15:00:00Z', new Date('2026-11-01T04:00:00Z'))).toEqual([
      '2026-10',
    ]);
  });

  it('HIS-11 con una creación posterior a ahora (desfase de reloj) devuelve el mes en curso', () => {
    expect(listStatementPeriods('2026-10-14T18:05:00Z', now)).toEqual(['2026-10']);
    expect(listStatementPeriods('2027-02-01T00:00:00Z', now)).toEqual(['2026-10']);
  });

  it('HIS-11 isPeriodBeforeCreation distingue meses anteriores, el de creación y posteriores', () => {
    const createdAt = '2026-07-20T15:00:00Z';

    expect(isPeriodBeforeCreation('2026-06', createdAt)).toBe(true);
    expect(isPeriodBeforeCreation('2025-12', createdAt)).toBe(true);
    expect(isPeriodBeforeCreation('2026-07', createdAt)).toBe(false);
    expect(isPeriodBeforeCreation('2026-08', createdAt)).toBe(false);
  });

  it('HIS-11 isPeriodBeforeCreation usa el mes local de creación', () => {
    // 2026-09-01 04:00Z son las 22:00 del 31 de agosto en la Ciudad de México.
    expect(isPeriodBeforeCreation('2026-07', '2026-09-01T04:00:00Z')).toBe(true);
    expect(isPeriodBeforeCreation('2026-08', '2026-09-01T04:00:00Z')).toBe(false);
    expect(isPeriodBeforeCreation('2026-09', '2026-09-01T04:00:00Z')).toBe(false);
  });

  it.each(['2026-13', '2026-9', '202609', ''])('HIS-11 isPeriodBeforeCreation rechaza %s', (p) => {
    expect(() => isPeriodBeforeCreation(p, '2026-07-20T15:00:00Z')).toThrow(RangeError);
  });

  it('HIS-11 statementPeriodOf y statementPeriodLabel', () => {
    expect(statementPeriodOf('2026-10-01T05:00:00Z')).toBe('2026-09');
    expect(statementPeriodLabel('2026-09')).toBe('septiembre de 2026');
    expect(() => statementPeriodLabel('2026-9')).toThrow(RangeError);
  });
});
