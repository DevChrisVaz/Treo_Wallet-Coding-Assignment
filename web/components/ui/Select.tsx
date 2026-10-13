import type { ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type SelectProps = FieldProps & ComponentPropsWithRef<'select'>;

/** Selector nativo de cuenta o beneficiario (D7 de design-system). */
export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const ids = useFieldIds(id, { label, hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={ids.id}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
        className={`${CONTROL_CLASSES} ${className}`.trim()}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
