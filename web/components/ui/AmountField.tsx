'use client';

import { sanitizeAmountTyping } from '@devchrisvaz/wallet-contract';
import { useState, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { CONTROL_CLASSES, FieldFrame, useFieldIds, type FieldProps } from './field';

export type AmountFieldProps = FieldProps &
  Omit<ComponentPropsWithRef<'input'>, 'children' | 'type' | 'inputMode'> & {
    /** `hero` muestra el monto grande y centrado, sobre una línea inferior. */
    variant?: 'default' | 'hero';
  };

const SIGNIFICANT = /[\d.]/;

/** Cuántos dígitos y puntos hay antes de `end`: la posición del cursor que no cambia al dar formato. */
function significantBefore(text: string, end: number): number {
  let count = 0;
  for (let index = 0; index < end; index += 1) {
    if (SIGNIFICANT.test(text.charAt(index))) count += 1;
  }
  return count;
}

/** Posición en `text` después de `count` dígitos o puntos. */
function positionAfter(text: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (SIGNIFICANT.test(text.charAt(index))) seen += 1;
    if (seen === count) return index + 1;
  }
  return text.length;
}

/**
 * Da formato al texto del campo mientras se escribe o se pega (WEB-21): solo dígitos y un punto, hasta 2
 * decimales y comas de millar (`sanitizeAmountTyping` del contrato). El cursor se queda junto al mismo
 * dígito aunque aparezcan o desaparezcan comas. Devuelve el texto que quedó en el campo.
 */
export function formatAmountInput(input: HTMLInputElement): string {
  const raw = input.value;
  const { display } = sanitizeAmountTyping(raw);
  if (display === raw) return display;
  const caret = input.selectionStart ?? raw.length;
  const significant = significantBefore(raw, caret);
  input.value = display;
  // `significant` cuenta también lo que el saneamiento descartó (p. ej. un tercer decimal): se acota.
  const position = positionAfter(
    display,
    Math.min(significant, significantBefore(display, display.length)),
  );
  try {
    input.setSelectionRange(position, position);
  } catch {
    // Un campo sin selección posible (p. ej. fuera del documento): el cursor queda al final.
  }
  return display;
}

/**
 * Monto en MXN como texto (WEB-21): prefijo `$`, teclado decimal y formato mientras se escribe
 * (`12,345.67`; letras y símbolos no entran, tampoco al pegar). El formulario quita las comas antes de
 * enviarlo y lo valida con `amountInput` del contrato.
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
        className="grid-cols-1 justify-items-center text-center"
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
          {/*
           * Un monto largo no desborda la fila ni la página: la columna del marco es `minmax(0,1fr)`
           * (`grid-cols-1`), el espejo no pasa del ancho (`max-w-full`) y recorta lo que sobra.
           */}
          <span className="relative min-w-0 max-w-full">
            <span
              aria-hidden="true"
              data-testid="hero-amount-mirror"
              className="invisible block max-w-full overflow-x-clip pr-1 text-display whitespace-pre tabular-nums"
            >
              {text || props.placeholder || '0'}
            </span>
            <input
              autoComplete="off"
              {...rest}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setTyped(formatAmountInput(event.target));
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
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            formatAmountInput(event.target);
            props.onChange?.(event);
          }}
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
