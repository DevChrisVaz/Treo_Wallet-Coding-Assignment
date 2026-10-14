import type { NavDestination } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/ui/AppHeader';
import { SideNav } from '@/components/ui/SideNav';
import { TabBar, type NavItem } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { MAIN_CONTENT_ID, SkipLink } from './SkipLink';

export const DEFAULT_NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'movements', href: '/movements' },
  { key: 'transfer', href: '/transfers/new' },
  { key: 'beneficiaries', href: '/beneficiaries' },
];

export interface AppShellProps {
  current: NavDestination | null;
  title: string;
  primaryAction?: ReactNode;
  user: { name: string; email: string };
  onLogout?: () => void;
  /**
   * Cierre de sesión en curso: los botones de la navegación lateral y del menú de la cuenta muestran
   * "Cerrando…", ocupados y deshabilitados (WEB-05).
   */
  loggingOut?: boolean;
  /** `flow`: el flujo de transferencia, sin barra de pestañas ni encabezado de la app en teléfono. */
  mode?: 'tabs' | 'flow';
  items?: readonly NavItem[];
  children: ReactNode;
}

/**
 * Estructura con sesión (WEB-24): forma de app bajo 1024 px (columna de 480 px, encabezado y
 * pestañas) y forma de dashboard desde 1024 px (navegación lateral, barra superior y contenido de
 * hasta 1200 px).
 */
export function AppShell({
  current,
  title,
  primaryAction,
  user,
  onLogout,
  loggingOut,
  mode = 'tabs',
  items = DEFAULT_NAV_ITEMS,
  children,
}: AppShellProps) {
  const tabs = mode === 'tabs';
  return (
    <div className="min-h-dvh bg-surface-canvas dashboard:flex">
      <SkipLink />
      <SideNav
        items={items}
        current={current}
        user={user}
        onLogout={onLogout}
        loggingOut={loggingOut}
        className="hidden dashboard:flex"
      />
      <div className="w-full min-w-0 dashboard:px-10">
        <div className="mx-auto w-full max-w-app dashboard:max-w-content">
          {tabs ? (
            <AppHeader
              user={user}
              title={current === 'home' ? undefined : title}
              onLogout={onLogout}
              loggingOut={loggingOut}
              className="dashboard:hidden"
            />
          ) : null}
          {tabs ? (
            <TopBar title={title} action={primaryAction} className="hidden dashboard:flex" />
          ) : null}
          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            // Con pestañas, 20 px entre el encabezado y el contenido en teléfono, como el margen del
            // contenido de Screen en la app móvil (WEB-25); en el flujo lo da FlowHeader. Abajo reserva
            // el alto real de la barra de pestañas, que TabBar publica (crece con el texto agrandado),
            // su borde de 1 px y otros 20 px, el mismo margen de Screen sobre la barra.
            className={`grid gap-5 px-5 focus-visible:outline-none dashboard:px-0 dashboard:pb-10 ${
              tabs
                ? 'pt-5 pb-[calc(var(--tab-bar-height,var(--dt-layout-tab-bar-height))+env(safe-area-inset-bottom)+1px+1.25rem)] dashboard:pt-0'
                : 'pb-6'
            }`}
          >
            {children}
          </main>
        </div>
      </div>
      {tabs ? <TabBar items={items} current={current} className="dashboard:hidden" /> : null}
    </div>
  );
}
