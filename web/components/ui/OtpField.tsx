import type { ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type OtpFieldProps = FieldProps &
  Omit<ComponentPropsWithRef<'input'>, 'children' | 'type' | 'inputMode' | 'autoComplete'>;

/**
 * Código de 6 dígitos en un solo campo: acepta pegar y el autocompletado del sistema (D7). Ocupa el
 * ancho del formulario con el texto del campo y 8 px entre dígitos, como en la app móvil (WEB-25).
 */
export function OtpField({ label, hint, error, id, className = '', ...props }: OtpFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        id={ids.id}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
        className={`${CONTROL_CLASSES} tracking-[0.5em] tabular-nums ${className}`.trim()}
      />
    </FieldFrame>
  );
}
