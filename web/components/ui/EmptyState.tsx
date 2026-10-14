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

/**
 * Estado vacío: título, una línea de ayuda y una acción (D7 de design-system). La ayuda va en texto
 * de cuerpo y la acción a 12 px, como en la app móvil (WEB-25).
 */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg bg-surface px-6 py-10 text-center shadow-card">
      {icon ? <Avatar size="lg" icon={icon} /> : null}
      <h2 className="text-h3 text-fg">{title}</h2>
      {description ? <p className="text-body text-fg-secondary">{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
