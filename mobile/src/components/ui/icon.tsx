import { iconSize, type IconConcept } from '@devchrisvaz/wallet-design-tokens';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
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
  Share2,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

/** Componente de Lucide de cada concepto; una prueba lo compara con `iconNames` (DSG-15). */
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
 * Glifos propios de la app que aún no están en el mapa compartido de `design-tokens`: buscar
 * (`search`), recibir dinero (flecha entrante, `receive`), copiar (`copy`) y compartir (`share`).
 * Nombres iguales a los que usa la web para la misma función (MOB-28, MOB-29).
 */
export const EXTRA_ICONS = {
  search: Search,
  receive: ArrowDownToLine,
  copy: Copy,
  share: Share2,
} as const satisfies Record<string, LucideIcon>;

export type ExtraIconConcept = keyof typeof EXTRA_ICONS;
/** Todo lo que `Icon` sabe dibujar: los conceptos compartidos más los glifos propios. */
export type IconName = IconConcept | ExtraIconConcept;

const GLYPHS: Record<IconName, LucideIcon> = { ...ICONS, ...EXTRA_ICONS };

interface IconProps {
  name: IconName;
  size?: keyof typeof iconSize;
  color: string;
  /** Solo cuando el icono comunica algo sin texto al lado; si no, es decorativo. */
  label?: string;
}

/** Icono de línea del sistema (DSG-15): decorativo salvo que tenga etiqueta. */
export function Icon({ name, size = 'md', color, label }: IconProps) {
  const Glyph = GLYPHS[name];
  // `aria-label` (no `accessibilityLabel`): Lucide solo deja de ocultar el SVG si ve una prop `aria-*`.
  return label ? (
    <Glyph
      size={iconSize[size]}
      color={color}
      strokeWidth={2}
      accessible
      accessibilityRole="image"
      aria-label={label}
    />
  ) : (
    // Decorativo: `aria-hidden` en una View, que lo traduce en iOS, Android y la web. El Svg de
    // react-native-svg no lo traduce en nativo, y react-native-web no reconoce
    // `accessibilityElementsHidden` ni `importantForAccessibility`.
    <View aria-hidden>
      <Glyph size={iconSize[size]} color={color} strokeWidth={2} />
    </View>
  );
}

interface IconButtonProps {
  icon: IconName;
  /** Obligatoria: es el único nombre accesible del botón. */
  label: string;
  onPress: () => void;
  tone?: 'default' | 'onDark';
}

/** Botón solo con icono, de 44 px y con nombre accesible (DSG-15). */
export function IconButton({ icon, label, onPress, tone = 'default' }: IconButtonProps) {
  const color = tone === 'onDark' ? theme.colors.text.onInverse : theme.colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={theme.spacing[1]}
      style={styles.button}
    >
      <Icon name={icon} size="lg" color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: theme.touchTarget,
    height: theme.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
});
