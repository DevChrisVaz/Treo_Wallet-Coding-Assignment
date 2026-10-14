'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Campos con selector propio del navegador (calendario, reloj). */
const PICKER_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week']);

function isPickerInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && PICKER_TYPES.has(target.type);
}

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Hoja inferior modal (DSG-17): en teléfono sube desde abajo; en el dashboard es un panel centrado.
 * Atrapa el foco, Escape la cierra (salvo en un campo de fecha u hora) y el foco vuelve al control
 * que la abrió. Mientras está abierta, la página de fondo no se desplaza, y en escritorio no se corre
 * el ancho de la barra de desplazamiento que el bloqueo quita.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // El manejador vive en `document`: un clic en contenido no enfocable del panel deja el foco
  // en el panel (tabIndex -1) o en <body>, y aun así Tab y Escape deben seguir funcionando.
  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    // La página no se desplaza detrás de la hoja (en teléfono, el dedo arrastraría el fondo).
    const { body, documentElement: root } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    // Ancho de la barra de desplazamiento clásica (escritorio); 0 con barras superpuestas (teléfono).
    // Sin layout (`clientWidth` 0) no hay barra que medir.
    const scrollbar = root.clientWidth > 0 ? window.innerWidth - root.clientWidth : 0;
    body.style.overflow = 'hidden';
    // Al bloquear, la barra desaparece: el relleno ocupa su lugar y la página no se corre a la derecha.
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // En un campo de fecha u hora, Escape cierra el selector del campo, no la hoja.
        if (isPickerInput(event.target)) return;
        onCloseRef.current();
        return;
      }
      const sheet = panel.current;
      if (event.key !== 'Tab' || !sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      const active = document.activeElement;
      if (!(active instanceof Node) || !sheet.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      // El propio panel cuenta como "antes del primero": Shift+Tab desde ahí da la vuelta.
      if (event.shiftKey && (active === first || active === sheet)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center dashboard:items-center">
      <div aria-hidden="true" className="absolute inset-0 bg-surface-hero/60" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full max-w-app flex-col gap-4 rounded-t-lg bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-sheet focus:outline-none dashboard:max-w-md dashboard:rounded-lg dashboard:pb-6"
      >
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 shrink-0 rounded-pill bg-border dashboard:hidden"
        />
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2 id={titleId} className="text-h3 text-fg">
            {title}
          </h2>
          <IconButton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
