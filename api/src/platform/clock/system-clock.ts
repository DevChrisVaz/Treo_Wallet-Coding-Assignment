import type { Clock } from '../../shared/clock.js';

/** Reloj del sistema (en AWS sincronizado con Amazon Time Sync). */
export const systemClock: Clock = {
  now: () => new Date(),
};
