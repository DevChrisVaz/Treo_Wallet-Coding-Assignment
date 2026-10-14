import type { Money } from '../../../shared/money.js';

/** Lectura (sin bloqueo) del uso del límite diario de un usuario en un día de CDMX. */
export interface DailyUsageReader {
  /** `null` si ese día aún no hay transferencias a terceros completadas. */
  usage(userId: string, day: string): Promise<{ used: Money; limit: Money } | null>;
}
