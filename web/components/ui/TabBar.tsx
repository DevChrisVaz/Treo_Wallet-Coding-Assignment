'use client';

import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { RouterLink } from './RouterLink';

export interface NavItem {
  key: NavDestination;
  href: string;
}

export interface TabBarProps {
  items: readonly NavItem[];
  current: NavDestination | null;
  /** `static` para mostrarla dentro de una tarjeta (previews); en la app va fija abajo. */
  position?: 'fixed' | 'static';
  className?: string;
}

/** Alto real de la barra fija (sin su borde ni el área segura), que AppShell reserva bajo el contenido. */
export const TAB_BAR_HEIGHT_VAR = '--tab-bar-height';

/**
 * Barra de pestañas de la forma de app (WEB-27). La pestaña actual lleva el icono en lima dentro de
 * una píldora verde profundo (lima solo sobre oscuro, DSG-14). Las cuatro pestañas miden lo mismo:
 * con el texto agrandado (200 %, WCAG 1.4.4) la píldora se ajusta al ancho de la pestaña, la etiqueta
 * pasa de línea y la barra crece, sin que ninguna pestaña salga de la pantalla.
 */
export function TabBar({ items, current, position = 'fixed', className = '' }: TabBarProps) {
  const list = useRef<HTMLUListElement>(null);
  const fixed = position === 'fixed';

  // Fija abajo, publica su alto real para que el contenido no quede debajo cuando crece.
  // jsdom no tiene ResizeObserver; AppShell usa entonces el alto del token.
  useEffect(() => {
    const element = list.current;
    if (!fixed || !element || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty(TAB_BAR_HEIGHT_VAR, `${element.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(TAB_BAR_HEIGHT_VAR);
    };
  }, [fixed]);

  return (
    <nav
      aria-label="Principal"
      className={`${fixed ? 'fixed inset-x-0 bottom-0 z-20' : ''} border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] ${className}`.trim()}
    >
      <ul ref={list} className="mx-auto flex min-h-(--dt-layout-tab-bar-height) max-w-app">
        {items.map(({ key, href }) => {
          const { label, icon } = navDestinations[key];
          const active = key === current;
          return (
            <li key={key} className="flex min-w-0 flex-1">
              <RouterLink
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-caption"
              >
                <span
                  className={`flex h-8 w-16 max-w-full items-center justify-center rounded-pill ${active ? 'bg-surface-hero text-accent-on-dark' : 'text-fg-muted'}`}
                >
                  <Icon name={icon} size="lg" />
                </span>
                {/* 1 px de holgura de redondeo: a 320 px "Beneficiarios" mide 80.3 px en una pestaña de
                    80 px y al 100 % no debe partirse; con el texto agrandado sí pasa de línea. */}
                <span
                  className={`max-w-[calc(100%+1px)] text-center [overflow-wrap:break-word] ${active ? 'font-medium text-action' : 'text-fg-muted'}`}
                >
                  {label}
                </span>
              </RouterLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
