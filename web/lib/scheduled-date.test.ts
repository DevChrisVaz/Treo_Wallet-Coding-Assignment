import { describe, expect, it, vi } from 'vitest';
import { formatScheduledDate, formatScheduledInstant } from './scheduled-date';

describe('formatScheduledDate', () => {
  it('WEB-33 escribe la fecha programada en palabras', () => {
    expect(formatScheduledDate('2026-10-20')).toBe('20 de octubre de 2026');
    expect(formatScheduledDate('2027-01-12')).toBe('12 de enero de 2027');
  });

  it.each(['America/Mexico_City', 'Pacific/Honolulu', 'Asia/Tokyo'])(
    'WEB-33 WEB-34 no recorre el día aunque el navegador esté en %s',
    (timeZone) => {
      // La fecha es de calendario: el huso del navegador no debe moverla (D11).
      vi.stubEnv('TZ', timeZone);
      expect(formatScheduledDate('2026-10-20')).toBe('20 de octubre de 2026');
      expect(formatScheduledDate('2027-01-01')).toBe('1 de enero de 2027');
    },
  );
});

describe('formatScheduledInstant', () => {
  it('WEB-33 escribe el instante en hora de la Ciudad de México', () => {
    expect(formatScheduledInstant('2026-10-20T20:30:00Z')).toBe('20 de octubre de 2026, 14:30');
    expect(formatScheduledInstant('2026-10-20T14:30:00-06:00')).toBe(
      '20 de octubre de 2026, 14:30',
    );
  });

  it('WEB-33 una fecha sola (formato anterior) se escribe sin hora', () => {
    expect(formatScheduledInstant('2026-10-20')).toBe('20 de octubre de 2026');
  });
});
