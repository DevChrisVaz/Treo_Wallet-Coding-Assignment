import { formatMXN, type DailyLimit } from '@devchrisvaz/wallet-contract';
import { percentUsed } from '@/lib/money';

/**
 * Límite diario (D7 de design-system, WEB-13): barra en el acento sobre el fondo neutro y "Te quedan
 * $X hoy" con el restante que calcula la API; el navegador no recalcula el límite.
 */
export function DailyLimitMeter({ dailyLimit }: { dailyLimit: DailyLimit }) {
  const percent = percentUsed(dailyLimit.used, dailyLimit.limit);

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-label text-fg">Límite diario</p>
        <p className="text-caption text-fg-muted tabular-nums">{formatMXN(dailyLimit.limit)}</p>
      </div>
      <div
        role="meter"
        aria-label="Límite diario"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`Usaste ${formatMXN(dailyLimit.used)} de ${formatMXN(dailyLimit.limit)}`}
        className="h-2 overflow-hidden rounded-pill bg-neutral-soft"
      >
        <div data-meter-fill className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-body-sm text-fg-secondary">
        Te quedan {formatMXN(dailyLimit.remaining)} hoy
      </p>
    </div>
  );
}
