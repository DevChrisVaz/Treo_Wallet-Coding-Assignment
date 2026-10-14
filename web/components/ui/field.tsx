import { useId, type ReactNode } from 'react';

/** Control de formulario del sistema: borde de campo, alto de 52 px y error en `status.danger`. */
export const CONTROL_CLASSES =
  'min-h-13 w-full rounded-md border border-border-input bg-surface px-4 text-body text-fg ' +
  'aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-fg-muted';

export interface FieldProps {
  label: ReactNode;
  /** Ayuda debajo del campo, asociada con `aria-describedby`. */
  hint?: ReactNode;
  /** Mensaje de error debajo del campo; marca el control con `aria-invalid`. */
  error?: ReactNode;
}

export interface FieldIds {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

/** Ids de la etiqueta, la ayuda y el error de un campo. */
export function useFieldIds(id: string | undefined, { hint, error }: FieldProps): FieldIds {
  const generated = useId();
  const controlId = id ?? generated;
  const describedBy = [hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null]
    .filter(Boolean)
    .join(' ');
  return { id: controlId, describedBy: describedBy || undefined, invalid: Boolean(error) };
}

/** Etiqueta visible arriba; ayuda y error debajo (D7 de design-system). */
export function FieldFrame({
  ids,
  label,
  hint,
  error,
  children,
}: FieldProps & { ids: FieldIds; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={ids.id} className="text-label text-fg">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${ids.id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${ids.id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
