import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayKey, dayLabel, groupByDay } from '../src/index';

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 del 13 de octubre en Ciudad de México

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Motor sin datos de zonas horarias: `Intl.DateTimeFormat` rechaza `America/Mexico_City`. */
function withoutTimeZoneData() {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () {
    throw new RangeError('Incorrect timeZone information provided');
  });
}

/** Carga el módulo de nuevo, sin el formateador que haya guardado una prueba anterior. */
async function freshDates() {
  vi.resetModules();
  return import('../src/dates');
}

describe('días en Ciudad de México', () => {
  it('DSG-17 dayKey usa la fecha de Ciudad de México, no la de UTC', () => {
    expect(dayKey('2026-10-13T05:30:00Z')).toBe('2026-10-12');
    expect(dayKey('2026-10-13T06:30:00Z')).toBe('2026-10-13');
  });

  it.each([
    ['2026-10-13T16:42:00Z', 'Hoy'],
    ['2026-10-13T05:30:00Z', 'Ayer'],
    ['2026-10-12T23:10:00Z', 'Ayer'],
    ['2026-10-09T18:20:00Z', '9 oct'],
    ['2025-12-28T18:00:00Z', '28 dic 2025'],
  ])('DSG-17 %s se agrupa como "%s"', (iso, label) => {
    expect(dayLabel(iso, NOW)).toBe(label);
  });

  it('DSG-17 groupByDay respeta el orden y agrupa días consecutivos', () => {
    const items = [
      '2026-10-13T16:42:00Z',
      '2026-10-12T23:10:00Z',
      '2026-10-12T15:05:00Z',
      '2026-10-09T18:20:00Z',
    ];
    const groups = groupByDay(items, (iso) => iso, NOW);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Hoy', 1],
      ['Ayer', 2],
      ['9 oct', 1],
    ]);
  });

  it.each(MONTHS.map((label, index) => [String(index + 1).padStart(2, '0'), label]))(
    'DSG-17 el mes %s se abrevia "%s", sin punto, con o sin año',
    (month, label) => {
      expect(dayLabel(`2026-${month}-15T18:00:00Z`, NOW)).toBe(`15 ${label}`);
      expect(dayLabel(`2025-${month}-15T18:00:00Z`, NOW)).toBe(`15 ${label} 2025`);
    },
  );
});

describe('días en Ciudad de México sin depender de Intl al importar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('DSG-17 importar el paquete no crea formateadores: el primero se crea al usarlo y se reutiliza', async () => {
    const created = vi.spyOn(Intl, 'DateTimeFormat');
    vi.resetModules();
    const tokens = await import('../src/index');
    expect(created).not.toHaveBeenCalled();
    tokens.dayKey('2026-10-13T16:42:00Z');
    tokens.dayLabel('2026-10-09T18:20:00Z', NOW);
    tokens.groupByDay(['2026-10-12T23:10:00Z'], (iso) => iso, NOW);
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('DSG-17 sin datos de zonas horarias en Intl, usa UTC−6 fijo y agrupa igual', async () => {
    withoutTimeZoneData();
    const { dayKey: key, dayLabel: label, groupByDay: group } = await freshDates();
    expect(key('2026-10-13T05:30:00Z')).toBe('2026-10-12');
    expect(key('2026-10-13T06:30:00Z')).toBe('2026-10-13');
    expect(label('2026-10-13T16:42:00Z', NOW)).toBe('Hoy');
    expect(label('2026-10-13T05:30:00Z', NOW)).toBe('Ayer');
    expect(label('2026-10-12T23:10:00Z', NOW)).toBe('Ayer');
    expect(label('2026-10-09T18:20:00Z', NOW)).toBe('9 oct');
    expect(label('2025-12-28T18:00:00Z', NOW)).toBe('28 dic 2025');
    expect(
      group(['2026-10-13T16:42:00Z', '2026-10-13T05:30:00Z'], (iso) => iso, NOW).map(
        (day) => day.label,
      ),
    ).toEqual(['Hoy', 'Ayer']);
  });

  it('DSG-17 sin datos de zonas horarias, los meses salen de la misma tabla fija', async () => {
    withoutTimeZoneData();
    const { dayLabel: label } = await freshDates();
    expect(
      MONTHS.map((_, index) => label(new Date(Date.UTC(2025, index, 15, 18)).toISOString(), NOW)),
    ).toEqual(MONTHS.map((month) => `15 ${month} 2025`));
  });
});
