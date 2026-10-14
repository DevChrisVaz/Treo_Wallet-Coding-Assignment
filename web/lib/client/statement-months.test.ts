import { describe, expect, it } from 'vitest';
import { statementMonths } from './statement-months';

const NOW = new Date('2026-10-14T18:00:00.000Z');

describe('statementMonths', () => {
  it('WEB-32 una cuenta de hace más de un año ofrece todos los meses desde su creación, el más reciente primero', () => {
    const months = statementMonths('2025-10-03T15:00:00.000Z', NOW);
    expect(months).toHaveLength(13);
    expect(months[0]).toEqual({ value: '2026-10', label: 'octubre 2026 (en curso)' });
    expect(months[1]).toEqual({ value: '2026-09', label: 'septiembre 2026' });
    expect(months.at(-1)).toEqual({ value: '2025-10', label: 'octubre 2025' });
  });

  it('WEB-32 una cuenta creada este mes ofrece solo el mes en curso', () => {
    expect(statementMonths('2026-10-01T15:00:00.000Z', NOW)).toEqual([
      { value: '2026-10', label: 'octubre 2026 (en curso)' },
    ]);
  });

  it('WEB-32 el mes de creación es el de la Ciudad de México: a las 23:30 del 30 de septiembre sigue siendo septiembre', () => {
    const months = statementMonths('2026-10-01T05:30:00.000Z', NOW);
    expect(months.map((month) => month.value)).toEqual(['2026-10', '2026-09']);
  });

  it('WEB-32 el mes en curso es el de la Ciudad de México y en enero el anterior es diciembre', () => {
    const months = statementMonths(
      '2026-11-10T15:00:00.000Z',
      new Date('2027-01-15T18:00:00.000Z'),
    );
    expect(months.map((month) => month.value)).toEqual(['2027-01', '2026-12', '2026-11']);
    expect(months[0]?.label).toBe('enero 2027 (en curso)');
    expect(months[1]?.label).toBe('diciembre 2026');
  });
});
