import type { ReactNode } from 'react';

/**
 * Barra superior del dashboard (WEB-26): título de la página y acción principal. El h1 acepta el foco
 * por programa (tabIndex -1), como el de AppHeader (WEB-23).
 */
export function TopBar({
  title,
  action,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`items-center justify-between gap-4 py-8 ${className}`.trim()}>
      <h1 tabIndex={-1} className="text-h1 text-fg focus-visible:outline-none">
        {title}
      </h1>
      {action}
    </header>
  );
}
