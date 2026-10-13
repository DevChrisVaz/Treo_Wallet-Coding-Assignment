'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Título de un paso del flujo. Recibe el foco al aparecer para que, con teclado o lector de
 * pantalla, el cambio de paso se note y la navegación siga desde ahí (WEB-23).
 */
export function StepHeading({
  id,
  children,
  focus = true,
}: {
  id?: string;
  children: ReactNode;
  focus?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <h2 ref={ref} id={id} tabIndex={-1} className="text-h2 text-fg focus-visible:outline-none">
      {children}
    </h2>
  );
}
