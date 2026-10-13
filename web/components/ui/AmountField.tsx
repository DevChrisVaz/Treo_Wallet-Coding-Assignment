import type { ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type AmountFieldProps = FieldProps &
  Omit<ComponentPropsWithRef<'input'>, 'children' | 'type' | 'inputMode'>;

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
  ...props
}: AmountFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-body text-fg-muted"
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
