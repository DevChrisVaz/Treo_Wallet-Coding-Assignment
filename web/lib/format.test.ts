import { dayLabel } from '@devchrisvaz/wallet-design-tokens';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('una sola tabla de meses', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('WEB-29 septiembre es "sep" en filas y comprobantes, como en los encabezados de día, aunque el Intl del navegador diga "sept"', async () => {
    // Según la versión de ICU/CLDR del navegador, `short` abrevia septiembre "sept" (así lo hace
    // es-419 en Node 24): se simula un es-MX que lo dice y se vuelve a cargar el módulo.
    const RealDateTimeFormat = Intl.DateTimeFormat;
    class SeptDateTimeFormat extends RealDateTimeFormat {
      constructor(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
        super(locales === 'es-MX' ? 'es-419' : locales, options);
      }
    }
    vi.stubGlobal('Intl', Object.create(Intl, { DateTimeFormat: { value: SeptDateTimeFormat } }));
    expect(new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(2026, 8, 15))).toBe(
      'sept',
    );
    vi.resetModules();
    const format = await import('./format');

    const september = '2026-09-30T15:05:00.000Z';
    expect(dayLabel(september, new Date('2026-10-13T18:00:00Z'))).toBe('30 sep');
    expect(format.formatDate(september)).toBe('30 sep 2026');
    expect(format.formatDateTime(september)).toBe('30 sep 2026, 09:05');
  });

  it('WEB-29 cada mes usa la abreviatura de los encabezados de día', () => {
    for (let month = 0; month < 12; month += 1) {
      const iso = new Date(Date.UTC(2025, month, 15, 18)).toISOString();
      expect(formatDate(iso)).toBe(dayLabel(iso, new Date('2026-10-13T18:00:00Z')));
    }
  });
});
