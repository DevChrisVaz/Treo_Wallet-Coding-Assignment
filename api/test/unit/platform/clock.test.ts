import { describe, expect, it } from 'vitest';
import { systemClock } from '../../../src/platform/clock/system-clock.js';
import { FakeClock } from '../../helpers/fake-clock.js';

describe('IDN-11 puerto de reloj', () => {
  it('IDN-11 el reloj del sistema devuelve la hora actual', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('IDN-12 el reloj falso solo avanza cuando la prueba lo indica', () => {
    const clock = new FakeClock('2026-10-13T23:59:59.900-06:00');
    expect(clock.now().toISOString()).toBe('2026-10-14T05:59:59.900Z');
    clock.advance(200);
    expect(clock.now().toISOString()).toBe('2026-10-14T06:00:00.100Z');
    clock.set('2026-01-01T00:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('IDN-12 modificar la fecha devuelta no altera el reloj', () => {
    const clock = new FakeClock('2026-10-13T12:00:00Z');
    clock.now().setFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('IDN-12 puede devolver una secuencia programada de horas', () => {
    const clock = new FakeClock('2026-10-13T12:00:00Z');
    clock.queue('2026-10-14T05:59:59.900Z', '2026-10-14T06:00:00.100Z');
    expect(clock.now().toISOString()).toBe('2026-10-14T05:59:59.900Z');
    expect(clock.now().toISOString()).toBe('2026-10-14T06:00:00.100Z');
    // Agotada la secuencia, se queda en la última hora devuelta.
    expect(clock.now().toISOString()).toBe('2026-10-14T06:00:00.100Z');
  });
});
