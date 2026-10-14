'use client';

import { useState, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type AmountFieldProps = FieldProps &
  Omit<ComponentPropsWithRef<'input'>, 'children' | 'type' | 'inputMode'> & {
    /** `hero` muestra el monto grande y centrado, sobre una línea inferior. */
    variant?: 'default' | 'hero';
  };

/**
 * Monto en MXN como texto (WEB-21): prefijo `$`, teclado decimal y sin conversión a número. El
 * formulario limpia los separadores y lo valida con `amountInput` del contrato.
 */
export function AmountField({
  label,
  hint,
  error,
  id,
  className = '',
  variant = 'default',
  ...props
}: AmountFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  // Largo del texto escrito: en la variante hero el campo mide eso, para que "$" y el monto
  // queden juntos al centro en lugar de "$" a la izquierda y los dígitos al centro (WEB-30).
  const [typed, setTyped] = useState(() => String(props.value ?? props.defaultValue ?? '').length);
  if (variant === 'hero') {
    const { onChange, style, ...rest } = props;
    const length = props.value === undefined ? typed : String(props.value).length;
    return (
      <FieldFrame ids={ids} label={label} hint={hint} error={error}>
        <div className="flex items-baseline justify-center gap-1 border-b-2 border-border-input py-4 focus-within:border-action">
          <span aria-hidden="true" className="text-display text-fg-muted">
            $
          </span>
          <input
            autoComplete="off"
            {...rest}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setTyped(event.target.value.length);
              onChange?.(event);
            }}
            type="text"
            inputMode="decimal"
            id={ids.id}
            aria-invalid={ids.invalid || undefined}
            aria-describedby={ids.describedBy}
            style={{ ...style, width: `calc(${Math.max(length, 1)}ch + 0.25em)` }}
            className={`min-w-0 max-w-full bg-transparent text-center text-display text-fg tabular-nums outline-none ${className}`.trim()}
          />
        </div>
      </FieldFrame>
    );
  }
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-body text-fg-muted"
        >
          $
        </span>
        <input
          autoComplete="off"
          {...props}
          type="text"
          inputMode="decimal"
          id={ids.id}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          className={`${CONTROL_CLASSES} pl-8 tabular-nums ${className}`.trim()}
        />
      </div>
    </FieldFrame>
  );
}
