import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './format';

describe('formatDateTime', () => {
  it('WEB-14 muestra la fecha y hora en la zona de Ciudad de México, formato de 24 horas', () => {
    expect(formatDateTime('2026-10-13T16:42:00.000Z')).toMatch(/^13 oct 2026, 10:42$/);
  });

  it('WEB-13 un instante pasada la medianoche UTC sigue siendo el día anterior en CDMX', () => {
    expect(formatDateTime('2026-10-14T05:59:00.000Z')).toMatch(/^13 oct 2026, 23:59$/);
  });
});

describe('formatTime', () => {
  it('WEB-16 muestra la hora de expiración del código en CDMX', () => {
    expect(formatTime('2026-10-13T16:52:00.000Z')).toBe('10:52');
  });
});

describe('formatDate', () => {
  it('WEB-14 muestra solo la fecha en CDMX, sin cortar la de formatDateTime', () => {
    expect(formatDate('2026-10-13T16:42:00.000Z')).toBe('13 oct 2026');
    expect(formatDate('2026-10-14T05:59:00.000Z')).toBe('13 oct 2026');
  });
});
