import type { ReactNode } from 'react';

/** Barra superior del dashboard (WEB-26): título de la página y acción principal. */
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
      <h1 className="text-h1 text-fg">{title}</h1>
      {action}
    </header>
  );
}
