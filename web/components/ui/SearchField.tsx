'use client';

import { useRef, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';
import { Icon } from './Icon';

export type SearchFieldProps = Omit<FieldProps, 'label'> &
  Omit<ComponentPropsWithRef<'input'>, 'children' | 'type'> & {
    /** Nombre accesible del campo: la etiqueta no se ve, el placeholder describe qué se busca (WEB-36). */
    label: string;
    /** Valor controlado: con él y `onClear`, aparece el botón "Borrar búsqueda". */
    value?: string;
    /** Se llama al pulsar la × (o con Escape); el padre vacía su estado. */
    onClear?: () => void;
  };

/**
 * Campo de búsqueda (WEB-36): icono de lupa a la izquierda, `type="search"` y, con texto, una
 * × de 44 px que lo vacía. La etiqueta es solo para lectores de pantalla. El filtro lo hace el padre.
 */
export function SearchField({
  label,
  hint,
  error,
  id,
  className = '',
  value,
  onClear,
  onChange,
  onKeyDown,
  ...props
}: SearchFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  const input = useRef<HTMLInputElement>(null);
  const filled = (value ?? '').length > 0;
  const clear = () => {
    onClear?.();
    input.current?.focus();
  };
  return (
    <FieldFrame
      ids={ids}
      label={<span className="sr-only">{label}</span>}
      hint={hint}
      error={error}
    >
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          autoComplete="off"
          {...props}
          ref={input}
          type="search"
          value={value}
          id={ids.id}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.key === 'Escape' && filled && onClear) {
              event.preventDefault();
              clear();
            }
          }}
          className={`${CONTROL_CLASSES} pl-11 ${filled && onClear ? 'pr-12' : ''} [&::-webkit-search-cancel-button]:hidden ${className}`.trim()}
        />
        {filled && onClear ? (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={clear}
            className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill text-fg-muted hover:text-fg"
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
    </FieldFrame>
  );
}
