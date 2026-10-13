'use client';

import { formatMXN, type Account } from '@devchrisvaz/wallet-contract';
import { useId, useState, type ReactNode } from 'react';

export interface AccountCardProps {
  account: Pick<Account, 'name' | 'clabe' | 'balance'>;
  selected?: boolean;
  /** Acciones de la tarjeta (por ejemplo, "Ver movimientos"). */
  children?: ReactNode;
}

/**
 * Tarjeta de cuenta (D7 de design-system): nombre, CLABE enmascarada salvo los últimos 4 dígitos y
 * saldo en `display` con dígitos tabulares. La CLABE completa se puede mostrar para compartirla.
 */
export function AccountCard({ account, selected = false, children }: AccountCardProps) {
  const titleId = useId();
  const clabeId = useId();
  const [showClabe, setShowClabe] = useState(false);

  return (
    <article
      aria-labelledby={titleId}
      className={`grid gap-2 rounded-md bg-surface-brand p-5 shadow-card ${selected ? 'ring-2 ring-action' : ''}`.trim()}
    >
      <h3 id={titleId} className="text-label text-fg">
        {account.name}
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
      <p className="text-display text-fg tabular-nums">{formatMXN(account.balance)}</p>
      {children ? <div className="flex flex-wrap gap-2 pt-1">{children}</div> : null}
    </article>
  );
}
