import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acción sugerida (WEB-20). */
  action?: ReactNode;
}

/** Estado vacío: título, una línea de ayuda y una acción (D7 de design-system). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-md bg-surface-subtle px-6 py-10 text-center">
      <h2 className="text-h3 text-fg">{title}</h2>
      {description ? <p className="text-body-sm text-fg-secondary">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
