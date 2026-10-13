import type { ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type TextFieldProps = FieldProps & Omit<ComponentPropsWithRef<'input'>, 'children'>;

/** Campo de texto, correo o contraseña (D7 de design-system). */
export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <input
        type="text"
        {...props}
        id={ids.id}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
        className={`${CONTROL_CLASSES} ${className}`.trim()}
      />
    </FieldFrame>
  );
}
