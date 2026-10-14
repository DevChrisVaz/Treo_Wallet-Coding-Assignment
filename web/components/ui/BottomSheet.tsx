'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Hoja inferior modal (DSG-17): en teléfono sube desde abajo; en el dashboard es un panel centrado.
 * Atrapa el foco, Escape la cierra y el foco vuelve al control que la abrió.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center dashboard:items-center"
      onKeyDown={onKeyDown}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-surface-hero/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid w-full max-w-app gap-4 rounded-t-lg bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-sheet dashboard:max-w-md dashboard:rounded-lg dashboard:pb-6"
      >
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 rounded-pill bg-border dashboard:hidden"
        />
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-h3 text-fg">
            {title}
          </h2>
          <IconButton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
