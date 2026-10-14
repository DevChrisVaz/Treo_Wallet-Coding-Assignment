import type { ReactNode } from 'react';

/** Cómo van las acciones de un paso: `fixed` abajo en teléfono (flujo), `inline` en páginas con pestañas. */
export type StepActionsMode = 'fixed' | 'inline';

export interface StepActionsProps {
  children: ReactNode;
  /** Dos botones apilados en teléfono: el espaciador reserva más alto. */
  stacked?: boolean;
  /** `false`: en línea debajo del contenido (páginas con pestañas, como el detalle). */
  fixed?: boolean;
}

/**
 * Acciones de un paso del flujo (WEB-30). En teléfono quedan fijas abajo con un borde superior, como
 * el `footer` de Screen en la app móvil (WEB-25); el espaciador reserva su alto para que no tapen el
 * contenido. En el dashboard van en línea, debajo del paso.
 */
export function StepActions({ children, stacked = false, fixed = true }: StepActionsProps) {
  if (!fixed) return <div className="grid gap-3 dashboard:flex">{children}</div>;
  return (
    <>
      <div aria-hidden="true" className={`${stacked ? 'h-36' : 'h-21'} dashboard:hidden`} />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface-canvas px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dashboard:static dashboard:border-0 dashboard:bg-transparent dashboard:p-0">
        <div className="mx-auto grid max-w-app gap-3 dashboard:mx-0 dashboard:flex dashboard:max-w-none">
          {children}
        </div>
      </div>
    </>
  );
}
