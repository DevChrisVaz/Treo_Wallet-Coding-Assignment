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
 *
 * Mide lo mismo que la tarjeta de la app móvil (WEB-25): borde de 2 px (transparente o, si está
 * seleccionada, el anillo en verde de acción) y 4 px entre filas. Con `onSelect`, toda la tarjeta
 * selecciona, como el Pressable de la app móvil: el botón del nombre (dentro del `h3`, R2) se estira
 * sobre la tarjeta con un `::after` (R31). Lo que debe seguir siendo propio va encima (`z-10`): el
 * botón de la CLABE, con su área de 44 px en otro `::after`, la CLABE completa (para copiarla) y las
 * acciones de la tarjeta.
 */
export function AccountCard({ account, selected = false, onSelect, children }: AccountCardProps) {
  const titleId = useId();
  const clabeId = useId();
  const balanceId = useId();
  const [showClabe, setShowClabe] = useState(false);

  return (
    <article
      aria-labelledby={titleId}
      className={`relative grid gap-1 rounded-md border-2 bg-surface p-5 shadow-card ${selected ? 'border-action' : 'border-transparent'}`}
    >
      <h3 id={titleId} className="text-label text-fg">
        {onSelect ? (
          <button
            type="button"
            aria-pressed={selected}
            aria-describedby={balanceId}
            onClick={onSelect}
            className="text-left after:absolute after:-inset-0.5 after:rounded-md"
          >
            {account.name}
          </button>
        ) : (
          account.name
        )}
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          id={clabeId}
          className={`text-caption text-fg-secondary tabular-nums ${showClabe ? 'relative z-10' : ''}`.trim()}
        >
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
          className="relative z-10 rounded-sm px-1 text-caption text-action underline underline-offset-2 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2"
        >
          {showClabe ? 'Ocultar CLABE' : 'Mostrar CLABE'}
        </button>
      </div>
      <p id={balanceId} className="text-h2 text-fg tabular-nums">
        {formatMXN(account.balance)}
      </p>
      {children ? <div className="relative z-10 flex flex-wrap gap-2 pt-1">{children}</div> : null}
    </article>
  );
}
