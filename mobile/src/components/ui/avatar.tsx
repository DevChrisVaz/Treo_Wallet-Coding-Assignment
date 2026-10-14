import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

const { colors } = theme;

const TONES = {
  brand: { bg: colors.surface.brand, fg: colors.action.primary },
  success: { bg: colors.status.success.bg, fg: colors.status.success.fg },
  neutral: { bg: colors.status.neutral.bg, fg: colors.text.primary },
  hero: { bg: colors.surface.hero, fg: colors.accent.onDark },
} as const;

// Mismo peso que la web (`font-medium`): el texto chico usa la familia de 500.
const TEXT = {
  sm: { ...theme.typography.caption, fontFamily: theme.typography.label.fontFamily },
  md: theme.typography.label,
  lg: theme.typography.h3,
} as const;
const ICON_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const;

interface AvatarProps {
  tone?: keyof typeof TONES;
  size?: 'sm' | 'md' | 'lg';
  initials?: string;
  icon?: IconConcept;
}

/** Círculo con iniciales o icono (movimientos, cuenta, estados vacíos). Siempre decorativo. */
export function Avatar({ tone = 'brand', size = 'md', initials: text, icon }: AvatarProps) {
  const { bg, fg } = TONES[tone];
  const dimension = theme.avatarSize[size];
  return (
    <View
      aria-hidden
      style={[styles.circle, { width: dimension, height: dimension, backgroundColor: bg }]}
    >
      {icon ? (
        <Icon name={icon} size={ICON_SIZE[size]} color={fg} />
      ) : (
        <Text style={[TEXT[size], { color: fg }]}>{text}</Text>
      )}
    </View>
  );
}

/** Iniciales de las dos primeras palabras de un nombre, en mayúsculas (igual que la web). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-MX'))
    .join('');
}

const styles = StyleSheet.create({
  circle: { borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
});
