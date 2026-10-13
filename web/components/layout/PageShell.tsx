import type { ReactNode } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';

/** Destino del enlace "Saltar al contenido". */
export const MAIN_CONTENT_ID = 'contenido';

/** Primer elemento enfocable de cada página: visible solo al recibir foco con el teclado (WEB-23). */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-pill focus:bg-action focus:px-6 focus:py-3 focus:text-label focus:text-fg-on-action"
    >
      Saltar al contenido
    </a>
  );
}

export interface PageShellProps {
  /** Navegación o acciones del encabezado (por ejemplo, "Cerrar sesión"). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Estructura común: encabezado con el Wordmark y contenido principal enfocable. */
export function PageShell({ actions, children }: PageShellProps) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Wordmark />
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-8 focus-visible:outline-none"
      >
        {children}
      </main>
    </>
  );
}
