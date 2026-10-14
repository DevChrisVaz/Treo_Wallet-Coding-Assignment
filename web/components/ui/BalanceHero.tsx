import { formatMXN } from '@devchrisvaz/wallet-contract';
import { heroAmountSize, splitCents } from '@devchrisvaz/wallet-design-tokens';
import { useId, type ReactNode } from 'react';

const AMOUNT_SIZE = {
  displayXl: 'text-display-xl',
  display: 'text-display',
  h1: 'text-h1',
} as const;

export interface BalanceHeroProps {
  /** Saldo total en pesos como string decimal (`sumAmounts`). */
  total: string;
  /** Lo que queda del límite diario. */
  available: string;
  actions?: ReactNode;
}

/** Hero del saldo (WEB-28, DSG-13): verde profundo, resplandor lima y centavos más chicos. */
export function BalanceHero({ total, available, actions }: BalanceHeroProps) {
  const titleId = useId();
  const formatted = formatMXN(total);
  const [whole, cents] = splitCents(formatted);
  return (
    <section
      aria-labelledby={titleId}
      className="relative overflow-hidden rounded-lg bg-surface-hero p-6 text-fg-on-inverse"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-pill"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--dt-accent-on-dark) 35%, transparent), transparent 70%)',
        }}
      />
      <h2 id={titleId} className="relative text-label text-fg-on-hero-muted">
        Saldo total
      </h2>
      <p
        data-testid="hero-amount"
        className={`relative mt-1 whitespace-nowrap tabular-nums ${AMOUNT_SIZE[heroAmountSize(formatted)]}`}
      >
        <span className="sr-only">{formatted}</span>
        <span aria-hidden="true">
          {whole}
          <span className="text-h3">{cents}</span>
        </span>
      </p>
      <p className="relative mt-3 inline-flex min-h-7 items-center rounded-pill bg-accent-on-dark px-3 text-caption font-medium text-fg tabular-nums">
        Disponible hoy {formatMXN(available)}
      </p>
      {actions ? <div className="relative mt-6">{actions}</div> : null}
    </section>
  );
}
