import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { Avatar } from './Avatar';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acción sugerida (WEB-20). */
  action?: ReactNode;
  /** Icono decorativo sobre el título. */
  icon?: IconConcept;
}

/** Estado vacío: título, una línea de ayuda y una acción (D7 de design-system). */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg bg-surface px-6 py-10 text-center shadow-card">
      {icon ? <Avatar size="lg" icon={icon} /> : null}
      <h2 className="text-h3 text-fg">{title}</h2>
      {description ? <p className="text-body-sm text-fg-secondary">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
