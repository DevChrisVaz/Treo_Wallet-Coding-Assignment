import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonState {
  pressed: boolean;
  disabled: boolean;
}

export interface ButtonColors {
  background: string;
  text: string;
  border: string;
}

const { colors } = theme;

/** Colores de cada variante y estado, solo con tokens semánticos (DSG-02, DSG-03). */
export function buttonColors(
  variant: ButtonVariant,
  { pressed, disabled }: ButtonState,
): ButtonColors {
  if (disabled) {
    return {
      background: colors.action.disabled,
      text: colors.text.disabled,
      border: colors.action.disabled,
    };
  }
  switch (variant) {
    case 'primary': {
      const background = pressed ? colors.action.primaryActive : colors.action.primary;
      const text = pressed ? colors.text.onActionActive : colors.text.onAction;
      return { background, text, border: background };
    }
    case 'secondary':
      return {
        background: pressed ? colors.surface.brand : colors.surface.default,
        text: colors.action.primary,
        border: colors.action.primary,
      };
    case 'ghost':
      return {
        background: pressed ? colors.surface.brand : 'transparent',
        text: colors.action.primary,
        border: 'transparent',
      };
    case 'destructive':
      return {
        background: pressed ? colors.status.danger.bg : colors.surface.default,
        text: colors.status.danger.fg,
        border: colors.status.danger.fg,
      };
  }
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Enviando: deshabilitado, mismo tamaño, con indicador y `busy` para lectores de pantalla. */
  loading?: boolean;
  accessibilityHint?: string;
  /** Icono decorativo antes de la etiqueta. */
  icon?: IconConcept;
  /** Botón de un selector: anuncia si es la opción elegida. */
  selected?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
  icon,
  selected,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => {
        const palette = buttonColors(variant, { pressed, disabled: inactive });
        return [styles.base, { backgroundColor: palette.background, borderColor: palette.border }];
      }}
    >
      {({ pressed }) => {
        const palette = buttonColors(variant, { pressed, disabled: inactive });
        return (
          <View style={styles.content}>
            {loading ? <ActivityIndicator size="small" color={palette.text} /> : null}
            {icon && !loading ? <Icon name={icon} color={palette.text} /> : null}
            <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.spacing[12],
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing[6],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  label: { ...theme.typography.label, textAlign: 'center' },
});
