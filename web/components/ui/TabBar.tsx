import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

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

/**
 * Barra de pestañas de la forma de app (WEB-27). La pestaña actual lleva el icono en lima dentro de
 * una píldora verde profundo (lima solo sobre oscuro, DSG-14).
 */
export function TabBar({ items, current, position = 'fixed', className = '' }: TabBarProps) {
  return (
    <nav
      aria-label="Principal"
      className={`${position === 'fixed' ? 'fixed inset-x-0 bottom-0 z-20' : ''} border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] ${className}`.trim()}
    >
      <ul className="mx-auto flex h-(--dt-layout-tab-bar-height) max-w-app">
        {items.map(({ key, href }) => {
          const { label, icon } = navDestinations[key];
          const active = key === current;
          return (
            <li key={key} className="flex-1">
              <a
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex h-full flex-col items-center justify-center gap-1 text-caption"
              >
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-pill ${active ? 'bg-surface-hero text-accent-on-dark' : 'text-fg-muted'}`}
                >
                  <Icon name={icon} size="lg" />
                </span>
                <span className={active ? 'font-medium text-action' : 'text-fg-muted'}>
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
