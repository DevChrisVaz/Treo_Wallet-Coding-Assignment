import { describe, expect, it } from 'vitest';
import { statementMonths } from './statement-months';

describe('statementMonths', () => {
  it('WEB-32 el 14 de octubre de 2026 ofrece octubre (en curso) y de septiembre de 2026 a octubre de 2025', () => {
    const months = statementMonths(new Date('2026-10-14T18:00:00.000Z'));
    expect(months).toHaveLength(13);
    expect(months[0]).toEqual({ value: '2026-10', label: 'octubre 2026 (en curso)' });
    expect(months[1]).toEqual({ value: '2026-09', label: 'septiembre 2026' });
    expect(months.at(-1)).toEqual({ value: '2025-10', label: 'octubre 2025' });
    expect(months.map((month) => month.value)).toEqual([
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
      '2025-10',
    ]);
  });

  it('WEB-32 el mes en curso es el de la Ciudad de México: a las 23:30 del 30 de septiembre sigue siendo septiembre', () => {
    const months = statementMonths(new Date('2026-10-01T05:30:00.000Z'));
    expect(months[0]).toEqual({ value: '2026-09', label: 'septiembre 2026 (en curso)' });
    expect(months[1]?.value).toBe('2026-08');
  });

  it('WEB-32 en enero el mes anterior es diciembre del año pasado', () => {
    const months = statementMonths(new Date('2027-01-15T18:00:00.000Z'));
    expect(months.slice(0, 2)).toEqual([
      { value: '2027-01', label: 'enero 2027 (en curso)' },
      { value: '2026-12', label: 'diciembre 2026' },
    ]);
  });
});
