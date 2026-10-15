import { focusRing } from '@devchrisvaz/wallet-design-tokens';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

type NativeInputProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText' | 'editable'>;

export interface TextFieldProps extends NativeInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /**
   * `search`: búsqueda (MOB-29). Icono de lupa al inicio, botón × cuando hay texto y la etiqueta solo
   * como nombre accesible (el placeholder es la guía visual).
   */
  variant?: 'text' | 'email' | 'password' | 'search';
  error?: string | undefined;
  help?: string | undefined;
  disabled?: boolean;
  /** Texto fijo antes del valor, como el `$` del monto. */
  prefix?: string;
  inputStyle?: StyleProp<TextStyle>;
}

const variantProps: Record<NonNullable<TextFieldProps['variant']>, TextInputProps> = {
  text: {},
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    textContentType: 'emailAddress',
  },
  password: {
    secureTextEntry: true,
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'current-password',
    textContentType: 'password',
  },
  search: {
    role: 'searchbox',
    inputMode: 'search',
    returnKeyType: 'search',
    autoCapitalize: 'none',
    autoCorrect: false,
  },
};

/**
 * Campo con etiqueta visible arriba y ayuda o error debajo, asociados al campo para los lectores de
 * pantalla (`accessibilityHint`). Estados: reposo, foco, error y deshabilitado (DSG-11).
 */
export function TextField({
  label,
  value,
  onChangeText,
  variant = 'text',
  error,
  help,
  disabled = false,
  prefix,
  inputStyle,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.status.danger.fg
    : focused
      ? theme.colors.border.focus
      : theme.colors.border.input;
  const frame = [
    styles.frame,
    { borderColor, borderWidth: focused || error ? focusRing.width : 1 },
    disabled && styles.disabled,
  ];
  const note = error ?? help;
  const search = variant === 'search';
  const password = variant === 'password';
  const [revealed, setRevealed] = useState(false);

  const input = (
    <TextInput
      {...variantProps[variant]}
      {...(password && revealed ? { secureTextEntry: false } : {})}
      {...inputProps}
      accessibilityLabel={label}
      accessibilityHint={note}
      accessibilityState={{ disabled }}
      editable={!disabled}
      value={value}
      onChangeText={onChangeText}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      placeholderTextColor={theme.colors.text.muted}
      style={[
        styles.input,
        prefix || search || password ? styles.inputWithPrefix : frame,
        inputStyle,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      {search ? null : <Text style={styles.label}>{label}</Text>}
      {search ? (
        <View style={[frame, styles.row]}>
          <Icon name="search" color={theme.colors.text.muted} />
          {input}
          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar búsqueda"
              hitSlop={theme.spacing[2]}
              onPress={() => onChangeText('')}
              style={styles.clear}
            >
              <Icon name="close" color={theme.colors.text.secondary} />
            </Pressable>
          ) : null}
        </View>
      ) : password ? (
        <View style={[frame, styles.row]}>
          {input}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={theme.spacing[2]}
            onPress={() => setRevealed((current) => !current)}
            style={styles.clear}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} color={theme.colors.text.secondary} />
          </Pressable>
        </View>
      ) : prefix ? (
        <View style={[frame, styles.row]}>
          <Text style={styles.prefix}>{prefix}</Text>
          {input}
        </View>
      ) : (
        input
      )}
      {note ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[styles.note, error ? styles.error : null]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[1] },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  frame: {
    minHeight: theme.spacing[12] + theme.spacing[1],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface.default,
    paddingHorizontal: theme.spacing[4],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  input: { ...theme.typography.body, color: theme.colors.text.primary },
  inputWithPrefix: { flex: 1, minHeight: theme.spacing[12] + theme.spacing[1] },
  clear: {
    width: theme.spacing[8],
    height: theme.spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  prefix: { ...theme.typography.body, ...theme.amount, color: theme.colors.text.secondary },
  disabled: { backgroundColor: theme.colors.surface.subtle },
  note: { ...theme.typography.caption, color: theme.colors.text.muted },
  error: { color: theme.colors.status.danger.fg },
});
