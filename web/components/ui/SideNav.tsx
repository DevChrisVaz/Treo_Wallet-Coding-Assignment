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
}

// Va sobre bg-surface-hero: el anillo de foco es lima (R13), el del sistema no se vería sobre ese fondo.
const ITEM =
  'flex min-h-11 items-center gap-3 rounded-md px-3 text-label focus-visible:outline-accent-on-dark';

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
      <div className="grid gap-3 border-t border-fg-on-inverse/10 pt-4">
        <div className="flex items-center gap-3 px-3">
          <Avatar tone="brand" size="sm" initials={initials(user.name)} />
          <div className="min-w-0">
            <p className="truncate text-label">{user.name}</p>
            <p className="truncate text-caption text-fg-on-hero-muted">{user.email}</p>
          </div>
        </div>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            aria-busy={loggingOut || undefined}
            className={`${ITEM} text-fg-on-hero-muted enabled:hover:bg-fg-on-inverse/10 enabled:hover:text-fg-on-inverse disabled:cursor-not-allowed`}
          >
            <Icon name="logout" />
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
