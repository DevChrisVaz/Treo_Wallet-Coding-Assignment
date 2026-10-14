import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

export interface QuickAction {
  key: string;
  label: string;
  icon: IconConcept;
  onPress: () => void;
}

/** Acciones rápidas sobre el hero (MOB-19): círculo con icono lima y texto visible. */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, icon, onPress }) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={styles.action}
        >
          <View style={styles.circle}>
            <View style={[StyleSheet.absoluteFill, styles.tint]} />
            <Icon name={icon} size="lg" color={theme.colors.accent.onDark} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing[6] },
  action: { alignItems: 'center', gap: theme.spacing[2] },
  circle: {
    width: theme.spacing[12],
    height: theme.spacing[12],
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fondo translúcido del círculo (como `bg-fg-on-inverse/10` en la web) sin un rgba suelto.
  // `StyleSheet.absoluteFill` se aplica aparte: `absoluteFillObject` no existe en React Native 0.86.
  tint: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.text.onInverse,
    opacity: 0.1,
  },
  label: {
    ...theme.typography.caption,
    fontFamily: theme.typography.label.fontFamily,
    color: theme.colors.text.onInverse,
  },
});
