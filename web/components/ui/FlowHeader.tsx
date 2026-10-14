'use client';

import { useEffect, useRef } from 'react';
import { IconButton } from './Icon';
import { Stepper } from './Stepper';

export interface FlowHeaderProps {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  closeHref: string;
  /** `id` del título, para nombrar la región del paso con `aria-labelledby`. */
  titleId?: string;
  /** Al cambiar de paso, el título recibe el foco (WEB-23); al abrir la página, no. */
  focusTitle?: boolean;
}

/**
 * Encabezado del flujo de transferencia: cerrar, título y pasos (WEB-30). Va dentro del contenido
 * de AppShell, que da el margen lateral (20 px en teléfono, como en la app móvil, WEB-25); en el
 * dashboard baja a la altura del título de TopBar.
 */
export function FlowHeader({
  title,
  step,
  total,
  stepLabel,
  closeHref,
  titleId,
  focusTitle = false,
}: FlowHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Paso que ya se mostró: el foco se mueve solo cuando cambia, no al montar (también en StrictMode).
  const shown = useRef(`${step}·${title}`);
  useEffect(() => {
    const key = `${step}·${title}`;
    if (shown.current === key) return;
    shown.current = key;
    // Con teclado o lector de pantalla, el cambio de paso se nota y la navegación sigue desde aquí (WEB-23).
    if (focusTitle) heading.current?.focus();
  }, [step, title, focusTitle]);

  return (
    <header className="grid gap-4 pt-4 pb-2 dashboard:pt-8">
      <div className="flex items-center gap-2">
        <IconButton
          icon="close"
          label="Salir de la transferencia"
          href={closeHref}
          className="-ml-3"
        />
        <h1
          ref={heading}
          id={titleId}
          tabIndex={focusTitle ? -1 : undefined}
          className="text-h3 text-fg focus-visible:outline-none"
        >
          {title}
        </h1>
      </div>
      <Stepper current={step} total={total} label={stepLabel} />
    </header>
  );
}
