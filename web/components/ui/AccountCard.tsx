'use client';

import { formatMXN, type Account } from '@devchrisvaz/wallet-contract';
import { useId, useState, type ReactNode } from 'react';

export interface AccountCardProps {
  account: Pick<Account, 'name' | 'clabe' | 'balance'>;
  selected?: boolean;
  /** Hace de nombre y saldo un botón de selección con `aria-pressed`. */
  onSelect?: () => void;
  /** Acciones de la tarjeta (por ejemplo, "Ver movimientos"). */
  children?: ReactNode;
}

/**
 * Tarjeta de cuenta (D7 de design-system): nombre, CLABE enmascarada salvo los últimos 4 dígitos y
 * saldo en `h2` con dígitos tabulares. La CLABE completa se puede mostrar para compartirla.
 */
export function AccountCard({ account, selected = false, onSelect, children }: AccountCardProps) {
  const titleId = useId();
  const clabeId = useId();
  const balanceId = useId();
  const [showClabe, setShowClabe] = useState(false);

  return (
    <article
      aria-labelledby={titleId}
      className={`grid gap-2 rounded-md bg-surface p-5 shadow-card ${selected ? 'ring-2 ring-action' : ''}`.trim()}
    >
      <h3 id={titleId} className="text-label text-fg">
        {onSelect ? (
          <button
            type="button"
            aria-pressed={selected}
            aria-describedby={balanceId}
            onClick={onSelect}
            className="min-h-11 text-left"
          >
            {account.name}
          </button>
        ) : (
          account.name
        )}
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p id={clabeId} className="text-caption text-fg-secondary tabular-nums">
          {showClabe ? (
            `CLABE ${account.clabe}`
          ) : (
            <>
              {/* Los lectores de pantalla no leen los puntos de la máscara. */}
              <span className="sr-only">CLABE terminada en </span>
              <span aria-hidden="true">CLABE •••• </span>
              {account.clabe.slice(-4)}
            </>
          )}
        </p>
        <button
          type="button"
          aria-expanded={showClabe}
          aria-controls={clabeId}
          aria-label={`${showClabe ? 'Ocultar' : 'Mostrar'} CLABE de ${account.name}`}
          onClick={() => setShowClabe((value) => !value)}
          className="min-h-11 rounded-sm px-1 text-caption text-action underline underline-offset-2"
        >
          {showClabe ? 'Ocultar CLABE' : 'Mostrar CLABE'}
        </button>
      </div>
      <p id={balanceId} className="text-h2 text-fg tabular-nums">
        {formatMXN(account.balance)}
      </p>
      {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
    </article>
  );
}
