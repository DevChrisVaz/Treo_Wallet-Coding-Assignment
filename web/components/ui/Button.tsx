import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const BASE =
  'relative inline-flex min-h-12 items-center justify-center gap-2 rounded-pill border px-6 text-label ' +
  'transition-colors duration-150 ease-standard ' +
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-action-disabled disabled:text-fg-disabled';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-action text-fg-on-action ' +
    'enabled:hover:bg-action-active enabled:hover:text-fg-on-action-active',
  secondary:
    'border-action bg-surface text-action ' +
    'enabled:hover:border-action-active enabled:hover:bg-action-active enabled:hover:text-fg-on-action-active',
  ghost: 'border-transparent bg-transparent text-action enabled:hover:bg-surface-brand',
  destructive: 'border-danger bg-surface text-danger enabled:hover:bg-danger-soft',
};

/** Clases del botón, para aplicarlas también a enlaces con apariencia de botón. */
export function buttonClasses(variant: ButtonVariant = 'primary', className = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  /** Enviando: se deshabilita, anuncia `aria-busy` y muestra `loadingLabel` con el mismo tamaño. */
  loading?: boolean;
  loadingLabel?: ReactNode;
  /** Icono a la izquierda del texto. */
  icon?: IconName;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-pill border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

/** Botón del sistema (D7 de design-system): píldora, alto mínimo de 48 px y foco visible. */
export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel = 'Enviando…',
  icon,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, className)}
      {...props}
    >
      {loading ? (
        <>
          {/* El texto original conserva el ancho del botón; el de envío se superpone. */}
          <span aria-hidden="true" className="invisible">
            {icon ? <Icon name={icon} /> : null}
            {children}
          </span>
          <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
            <Spinner />
            {loadingLabel}
          </span>
        </>
      ) : (
        <>
          {icon ? <Icon name={icon} /> : null}
          {children}
        </>
      )}
    </button>
  );
}
