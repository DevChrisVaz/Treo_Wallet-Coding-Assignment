import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '@/theme';

import { TextField, type TextFieldProps } from './text-field';

type AmountFieldProps = Omit<TextFieldProps, 'variant' | 'prefix' | 'keyboardType'> & {
  /** `hero`: monto grande y centrado, sin caja, con subrayado (pantalla de transferir). */
  variant?: 'default' | 'hero';
};

const clean = (text: string) => text.replace(/[\s,]/g, '');

/**
 * Campo de monto: prefijo `$`, teclado decimal y valor como string. Quita espacios y comas al
 * escribir o pegar; nunca convierte a número (MOB-08, MOB-15). La validación la hace el formulario
 * con `amountInput` del contrato.
 */
export function AmountField({ onChangeText, variant = 'default', ...props }: AmountFieldProps) {
  if (variant === 'hero') return <HeroAmountField onChangeText={onChangeText} {...props} />;
  return (
    <TextField
      {...props}
      prefix="$"
      keyboardType="decimal-pad"
      inputMode="decimal"
      autoCorrect={false}
      onChangeText={(text) => onChangeText(clean(text))}
    />
  );
}

function HeroAmountField({
  label,
  value,
  onChangeText,
  error,
  help,
  disabled = false,
  inputStyle: _inputStyle,
  onFocus,
  onBlur,
  ...inputProps
}: Omit<AmountFieldProps, 'variant'>) {
  const [focused, setFocused] = useState(false);
  const note = error ?? help;
  const underline = error
    ? theme.colors.status.danger.fg
    : focused
      ? theme.colors.border.focus
      : theme.colors.border.input;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, { borderBottomColor: underline }, disabled && styles.disabled]}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          {...inputProps}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoCorrect={false}
          accessibilityLabel={label}
          accessibilityHint={note}
          accessibilityState={{ disabled }}
          editable={!disabled}
          value={value}
          onChangeText={(text) => onChangeText(clean(text))}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.text.muted}
          style={styles.input}
        />
      </View>
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
  container: { gap: theme.spacing[1], alignItems: 'center' },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[1],
    borderBottomWidth: 2,
    paddingVertical: theme.spacing[2],
    alignSelf: 'stretch',
  },
  prefix: { ...theme.typography.display, color: theme.colors.text.muted },
  input: {
    ...theme.typography.display,
    ...theme.amount,
    color: theme.colors.text.primary,
    textAlign: 'center',
    minWidth: theme.spacing[16],
  },
  disabled: { opacity: 0.5 },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
  error: { color: theme.colors.status.danger.fg },
});
