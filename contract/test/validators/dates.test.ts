import { describe, expect, it } from 'vitest';
import { mexicoCityDate, schedulableRange } from '../../src/index';

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

describe('schedulableRange', () => {
  it('CTR-18 va de mañana a 90 días después de hoy', () => {
    expect(schedulableRange(new Date('2026-10-14T18:00:00Z'))).toEqual({
      min: '2026-10-15',
      max: '2027-01-12',
    });
  });

  it('CTR-18 cambia de año en el último día de diciembre', () => {
    expect(schedulableRange(new Date('2026-12-31T23:00:00Z')).min).toBe('2027-01-01');
  });

  it('CTR-18 usa el día local, no el de UTC', () => {
    // 2026-10-15 03:00Z sigue siendo 14 de octubre en la Ciudad de México.
    expect(schedulableRange(new Date('2026-10-15T03:00:00Z')).min).toBe('2026-10-15');
  });

  it('CTR-18 cruza el 29 de febrero de un año bisiesto', () => {
    expect(schedulableRange(new Date('2028-02-28T18:00:00Z')).min).toBe('2028-02-29');
  });
});
