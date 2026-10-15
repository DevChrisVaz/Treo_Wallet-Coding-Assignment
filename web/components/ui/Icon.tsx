import { iconSize, type IconConcept } from '@devchrisvaz/wallet-design-tokens';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Check,
  ChevronsUpDown,
  CircleCheck,
  Copy,
  House,
  Info,
  Landmark,
  LogOut,
  ReceiptText,
  Repeat2,
  Search,
  Send,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { RouterLink } from './RouterLink';

/** Componente de Lucide de cada concepto; una prueba lo compara con `iconNames` del paquete (DSG-15). */
export const ICONS = {
  home: House,
  movements: ReceiptText,
  transfer: Send,
  scheduled: CalendarClock,
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

/**
 * Glifos de la interfaz que aún no son un concepto del paquete de tokens (DSG-15): buscar,
 * copiar, confirmar y el selector de dos chevrones del botón de perfil. Si se vuelven conceptos
 * compartidos con la app móvil, pasan a `iconConcepts`.
 */
export const EXTRA_ICONS = {
  search: Search,
  copy: Copy,
  check: Check,
  selector: ChevronsUpDown,
} as const satisfies Record<string, LucideIcon>;

export type ExtraIconName = keyof typeof EXTRA_ICONS;
export type IconName = IconConcept | ExtraIconName;

export interface IconProps {
  name: IconName;
  size?: keyof typeof iconSize;
  /** Solo cuando el icono comunica algo sin texto al lado; si no, es decorativo. */
  label?: string;
  className?: string;
}

/** Icono de línea del sistema (DSG-15): decorativo salvo que tenga etiqueta. */
export function Icon({ name, size = 'md', label, className = '' }: IconProps) {
  const Glyph =
    name in EXTRA_ICONS ? EXTRA_ICONS[name as ExtraIconName] : ICONS[name as IconConcept];
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
  icon: IconName;
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
    <RouterLink href={href} aria-label={label} className={classes}>
      <Icon name={icon} size="lg" />
    </RouterLink>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={classes}>
      <Icon name={icon} size="lg" />
    </button>
  );
}
