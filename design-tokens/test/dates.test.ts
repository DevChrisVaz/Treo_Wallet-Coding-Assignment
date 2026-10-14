import { describe, expect, it } from 'vitest';
import { dayKey, dayLabel, groupByDay } from '../src/index';

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 del 13 de octubre en Ciudad de México

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
    const items = ['2026-10-13T16:42:00Z', '2026-10-12T23:10:00Z', '2026-10-12T15:05:00Z', '2026-10-09T18:20:00Z'];
    const groups = groupByDay(items, (iso) => iso, NOW);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([['Hoy', 1], ['Ayer', 2], ['9 oct', 1]]);
  });
});
