import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';
import { RouterLink } from './RouterLink';

export interface QuickAction {
  key: string;
  label: string;
  icon: IconConcept;
  href?: string;
  onClick?: () => void;
}

/** Acciones rápidas sobre el hero: círculo con icono lima y texto visible (WEB-28). */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <ul className="flex gap-6">
      {actions.map(({ key, label, icon, href, onClick }) => {
        const content = (
          <>
            <span className="flex size-12 items-center justify-center rounded-pill bg-fg-on-inverse/10 text-accent-on-dark">
              <Icon name={icon} size="lg" />
            </span>
            <span className="text-caption font-medium text-fg-on-inverse">{label}</span>
          </>
        );
        // Anillo lima: el de sistema no se ve sobre el hero oscuro (WEB-23, DSG-04).
        const classes =
          'flex flex-col items-center gap-2 rounded-md focus-visible:outline-accent-on-dark';
        return (
          <li key={key}>
            {href ? (
              <RouterLink href={href} className={classes}>
                {content}
              </RouterLink>
            ) : (
              <button type="button" onClick={onClick} className={classes}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
