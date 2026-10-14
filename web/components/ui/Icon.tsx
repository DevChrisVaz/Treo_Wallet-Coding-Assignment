import { iconSize, type IconConcept } from '@devchrisvaz/wallet-design-tokens';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  House,
  Info,
  Landmark,
  LogOut,
  ReceiptText,
  Repeat2,
  Send,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

/** Componente de Lucide de cada concepto; una prueba lo compara con `iconNames` del paquete (DSG-15). */
export const ICONS = {
  home: House,
  movements: ReceiptText,
  transfer: Send,
  beneficiaries: Users,
  logout: LogOut,
  moneyIn: ArrowDownLeft,
  moneyOut: ArrowUpRight,
  deposit: Landmark,
  ownTransfer: Repeat2,
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  close: X,
  back: ChevronLeft,
  forward: ChevronRight,
  expand: ChevronDown,
  filter: SlidersHorizontal,
  account: UserRound,
} as const satisfies Record<IconConcept, LucideIcon>;

export interface IconProps {
  name: IconConcept;
  size?: keyof typeof iconSize;
  /** Solo cuando el icono comunica algo sin texto al lado; si no, es decorativo. */
  label?: string;
  className?: string;
}

/** Icono de línea del sistema (DSG-15): decorativo salvo que tenga etiqueta. */
export function Icon({ name, size = 'md', label, className = '' }: IconProps) {
  const Glyph = ICONS[name];
  const px = iconSize[size];
  const classes = `shrink-0 ${className}`.trim();
  return label ? (
    <Glyph
      role="img"
      aria-label={label}
      width={px}
      height={px}
      strokeWidth={2}
      className={classes}
    />
  ) : (
    <Glyph
      aria-hidden="true"
      focusable="false"
      width={px}
      height={px}
      strokeWidth={2}
      className={classes}
    />
  );
}

export interface IconButtonProps {
  icon: IconConcept;
  /** Obligatoria: es el único nombre accesible del botón. */
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: 'default' | 'onDark';
  className?: string;
}

/** Botón o enlace solo con icono, de 44 px y con nombre accesible (DSG-15). */
export function IconButton({
  icon,
  label,
  onClick,
  href,
  tone = 'default',
  className = '',
}: IconButtonProps) {
  // Sobre superficies oscuras el anillo de foco es lima: el de sistema (#1C4B42) no se vería (WEB-23, DSG-04).
  const classes = `inline-flex size-11 items-center justify-center rounded-pill ${
    tone === 'onDark'
      ? 'text-fg-on-inverse hover:bg-fg-on-inverse/10 focus-visible:outline-accent-on-dark'
      : 'text-fg hover:bg-surface-subtle'
  } ${className}`.trim();
  return href ? (
    <a href={href} aria-label={label} className={classes}>
      <Icon name={icon} size="lg" />
    </a>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={classes}>
      <Icon name={icon} size="lg" />
    </button>
  );
}
