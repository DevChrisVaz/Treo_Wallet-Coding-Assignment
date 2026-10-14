import { useId, type ReactNode } from 'react';

export interface ListSectionProps {
  title?: string;
  /** Por ejemplo, "Ver todos". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Tarjeta de lista con encabezado opcional (DSG-17). */
export function ListSection({ title, action, children, className = '' }: ListSectionProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-lg bg-surface px-5 py-4 shadow-card ${className}`.trim()}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-4 pb-2">
          {title ? (
            <h2 id={titleId} className="text-h3 text-fg">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
