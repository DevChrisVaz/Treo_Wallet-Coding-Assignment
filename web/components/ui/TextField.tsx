'use client';

import { useState, type ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';
import { Icon } from './Icon';

export type TextFieldProps = FieldProps & Omit<ComponentPropsWithRef<'input'>, 'children'>;

/** Campo de texto, correo o contraseña (D7 de design-system). La contraseña lleva botón de mostrar u ocultar. */
export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
  const ids = useFieldIds(id, { label, hint, error });
  const [revealed, setRevealed] = useState(false);
  const password = props.type === 'password';
  const input = (
    <input
      {...props}
      type={password && revealed ? 'text' : (props.type ?? 'text')}
      id={ids.id}
      aria-invalid={ids.invalid || undefined}
      aria-describedby={ids.describedBy}
      className={`${CONTROL_CLASSES} ${password ? 'pe-12' : ''} ${className}`.trim()}
    />
  );
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error}>
      {password ? (
        <div className="relative">
          {input}
          <button
            type="button"
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={revealed}
            disabled={props.disabled}
            onClick={() => setRevealed((current) => !current)}
            className="absolute inset-y-0 end-1 my-auto inline-flex size-11 items-center justify-center rounded-pill text-fg-muted hover:text-fg disabled:cursor-not-allowed"
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} />
          </button>
        </div>
      ) : (
        input
      )}
    </FieldFrame>
  );
}
