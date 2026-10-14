'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { APP_DESTINATIONS, type AppDestination } from '@/lib/navigation';
import { Avatar, initials } from './Avatar';
import { Icon } from './Icon';
import { RouterLink } from './RouterLink';
import type { NavItem } from './TabBar';
import { Wordmark } from './Wordmark';

export interface SideNavProps {
  items: readonly NavItem[];
  current: AppDestination | null;
  user: { name: string; email: string };
  onLogout?: () => void;
  /** Cierre de sesión en curso: el botón muestra "Cerrando…", ocupado y deshabilitado (WEB-05). */
  loggingOut?: boolean;
  className?: string;
  /** Solo para lienzos y pruebas: el menú del perfil empieza abierto. */
  defaultMenuOpen?: boolean;
}

// Va sobre bg-surface-hero: el anillo de foco es lima (R13), el del sistema no se vería sobre ese fondo.
const ITEM =
  'flex min-h-11 items-center gap-3 rounded-md px-3 text-label focus-visible:outline-accent-on-dark';

/**
 * Perfil de la barra lateral (WEB-26): un solo botón de ancho completo con avatar, nombre y
 * correo (cada uno en una línea, con puntos suspensivos) y un selector a la derecha. Abre un menú
 * encima del botón con "Cerrar sesión". Escape, un clic fuera o elegir una opción lo cierran y el foco
 * vuelve al botón; las flechas, Inicio y Fin mueven el foco entre las opciones.
 */
function ProfileMenu({
  user,
  onLogout,
  loggingOut,
  defaultOpen,
}: {
  user: { name: string; email: string };
  onLogout: (() => void) | undefined;
  loggingOut: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const items = () => [
    ...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []),
  ];

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  // Al abrir con el teclado o el ratón, el foco va a la primera opción.
  useEffect(() => {
    if (open && !defaultOpen) items()[0]?.focus();
  }, [open, defaultOpen]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    const options = items();
    if (options.length === 0 || event.target === trigger.current) return;
    const at = options.indexOf(event.target as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      options[(index + options.length) % options.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(options.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Cuenta"
          className="absolute inset-x-0 bottom-full mb-2 grid rounded-md bg-surface p-1 text-fg shadow-sheet"
        >
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            aria-busy={loggingOut || undefined}
            onClick={() => {
              close(true);
              onLogout?.();
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-label enabled:hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-fg-muted"
          >
            <Icon name="logout" />
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      ) : null}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-label hover:bg-fg-on-inverse/10 focus-visible:outline-accent-on-dark aria-expanded:bg-fg-on-inverse/10"
      >
        <Avatar tone="brand" size="sm" initials={initials(user.name)} />
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-label">{user.name}</span>
          <span className="truncate text-caption text-fg-on-hero-muted">{user.email}</span>
        </span>
        <Icon name="selector" size="sm" className="text-fg-on-hero-muted" />
      </button>
    </div>
  );
}

/**
 * Navegación lateral del dashboard (WEB-26): verde profundo, destino actual en lima. Muestra todos los
 * destinos, también los `sideOnly` como "Programadas" (WEB-34).
 */
export function SideNav({
  items,
  current,
  user,
  onLogout,
  loggingOut = false,
  className = '',
  defaultMenuOpen = false,
}: SideNavProps) {
  return (
    <aside
      className={`sticky top-0 h-dvh w-sidebar shrink-0 flex-col gap-8 bg-surface-hero px-4 py-6 text-fg-on-inverse ${className}`.trim()}
    >
      <div className="px-3">
        <Wordmark variant="compact" tone="inverse" />
      </div>
      <nav aria-label="Principal" className="flex-1">
        <ul className="grid gap-1">
          {items.map(({ key, href }) => {
            const { label, icon } = APP_DESTINATIONS[key];
            const active = key === current;
            return (
              <li key={key}>
                <RouterLink
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`${ITEM} ${active ? 'bg-fg-on-inverse/10 text-accent-on-dark' : 'text-fg-on-hero-muted hover:bg-fg-on-inverse/10 hover:text-fg-on-inverse'}`}
                >
                  <Icon name={icon} />
                  {label}
                </RouterLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-fg-on-inverse/10 pt-4">
        <ProfileMenu
          user={user}
          onLogout={onLogout}
          loggingOut={loggingOut}
          defaultOpen={defaultMenuOpen}
        />
      </div>
    </aside>
  );
}
