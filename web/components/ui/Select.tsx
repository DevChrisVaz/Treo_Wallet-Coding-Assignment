import type { ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';
import { Icon } from './Icon';

export type SelectProps = FieldProps & ComponentPropsWithRef<'select'>;

/**
 * Selector nativo de cuenta o beneficiario (D7 de design-system). Sin la flecha del navegador: lleva
 * el chevron del sistema a la derecha, como el selector de la app móvil (WEB-25).
 */
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
      <div className="relative">
        <select
          {...props}
          id={ids.id}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          className={`${CONTROL_CLASSES} appearance-none pr-11 ${className}`.trim()}
        >
          {children}
        </select>
        <Icon
          name="expand"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fg-secondary"
        />
      </div>
    </FieldFrame>
  );
}
