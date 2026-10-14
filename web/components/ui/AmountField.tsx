import type { ComponentPropsWithRef } from 'react';
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
  if (variant === 'hero') {
    return (
      <FieldFrame ids={ids} label={label} hint={hint} error={error}>
        <div className="flex items-baseline justify-center gap-1 border-b-2 border-border-input py-4 focus-within:border-action">
          <span aria-hidden="true" className="text-display text-fg-muted">
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
            className={`w-full min-w-0 bg-transparent text-center text-display text-fg tabular-nums outline-none ${className}`.trim()}
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
