import type { Clock } from '../../src/shared/clock.js';

/**
 * Reloj controlado por la prueba: solo cambia con `set`, `advance` o una secuencia programada con
 * `queue` (útil para simular que la medianoche llega mientras se espera un bloqueo).
 */
export class FakeClock implements Clock {
  private current: number;
  private readonly scheduled: number[] = [];

  constructor(start: string | Date = '2026-10-13T18:00:00.000Z') {
    this.current = new Date(start).getTime();
  }

  now(): Date {
    const next = this.scheduled.shift();
    if (next !== undefined) this.current = next;
    return new Date(this.current);
  }

  set(time: string | Date): void {
    this.current = new Date(time).getTime();
  }

  advance(ms: number): void {
    this.current += ms;
  }

  /** Las siguientes llamadas a `now()` devuelven estas horas, en orden. */
  queue(...times: (string | Date)[]): void {
    this.scheduled.push(...times.map((time) => new Date(time).getTime()));
  }
}
