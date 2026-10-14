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
  // Texto escrito (sin control) para el espejo de la variante hero.
  const [typed, setTyped] = useState(() => String(props.value ?? props.defaultValue ?? ''));
  if (variant === 'hero') {
    const { onChange, ...rest } = props;
    const text = props.value === undefined ? typed : String(props.value);
    return (
      <FieldFrame
        ids={ids}
        label={label}
        hint={hint}
        error={error}
        className="justify-items-center text-center"
      >
        <div className="flex items-baseline justify-center gap-1 justify-self-stretch border-b-2 border-border-input py-2 focus-within:border-action">
          <span aria-hidden="true" className="text-display text-fg-muted">
            $
          </span>
          {/*
           * El campo mide lo que su texto: un espejo invisible da el ancho exacto (más 4 px para el
           * cursor) y el campo lo cubre, así "$" y el monto quedan juntos al centro, como con el
           * espejo de la app móvil (WEB-25, WEB-30). Medir en `ch` contaba la coma y el punto como
           * dígitos y dejaba aire alrededor del monto.
           */}
          <span className="relative min-w-0">
            <span
              aria-hidden="true"
              data-testid="hero-amount-mirror"
              className="invisible block pr-1 text-display whitespace-pre tabular-nums"
            >
              {text || props.placeholder || '0'}
            </span>
            <input
              autoComplete="off"
              {...rest}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setTyped(event.target.value);
                onChange?.(event);
              }}
              type="text"
              inputMode="decimal"
              id={ids.id}
              aria-invalid={ids.invalid || undefined}
              aria-describedby={ids.describedBy}
              className={`absolute inset-0 w-full bg-transparent text-center text-display text-fg tabular-nums outline-none ${className}`.trim()}
            />
          </span>
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
