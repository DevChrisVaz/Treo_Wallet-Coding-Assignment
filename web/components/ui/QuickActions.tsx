import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

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
        const classes = 'flex flex-col items-center gap-2 rounded-md';
        return (
          <li key={key}>
            {href ? (
              <a href={href} className={classes}>
                {content}
              </a>
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
