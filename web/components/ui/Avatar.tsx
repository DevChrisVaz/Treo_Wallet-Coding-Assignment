import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

const TONES = {
  brand: 'bg-surface-brand text-action',
  success: 'bg-success-soft text-success',
  neutral: 'bg-neutral-soft text-fg',
  hero: 'bg-surface-hero text-accent-on-dark',
} as const;

const SIZES = {
  sm: 'size-8 text-caption',
  md: 'size-10 text-label',
  lg: 'size-14 text-h3',
} as const;

export interface AvatarProps {
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  initials?: string;
  icon?: IconConcept;
  /**
   * Va dentro de un control que se nombra con su propia etiqueta (el botón "Menú de la cuenta",
   * design.md): las iniciales se dibujan con CSS (`content: attr(data-initials)`) y no son texto del
   * control, así su nombre accesible contiene todo su texto visible (WCAG 2.5.3, regla de axe
   * `label-content-name-mismatch`). Se ven igual.
   */
  insideLabelledControl?: boolean;
}

/** Círculo con iniciales o icono (movimientos, cuenta, estados vacíos). Siempre decorativo. */
export function Avatar({
  tone = 'brand',
  size = 'md',
  initials: text,
  icon,
  insideLabelledControl = false,
}: AvatarProps) {
  const drawn = insideLabelledControl && !icon;
  return (
    <span
      aria-hidden="true"
      data-initials={drawn ? text : undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-medium ${TONES[tone]} ${SIZES[size]}${drawn ? ' before:content-[attr(data-initials)]' : ''}`}
    >
      {icon ? (
        <Icon name={icon} size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'} />
      ) : drawn ? null : (
        text
      )}
    </span>
  );
}

/** Iniciales de las dos primeras palabras de un nombre, en mayúsculas. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-MX'))
    .join('');
}
