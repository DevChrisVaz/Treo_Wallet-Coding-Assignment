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
  // El monto héroe fija su propio estilo tipográfico: `inputStyle` no aplica y se descarta.
  inputStyle: _inputStyle,
  onFocus,
  onBlur,
  ...inputProps
}: Omit<AmountFieldProps, 'variant'>) {
  const [focused, setFocused] = useState(false);
  // Ancho del texto medido en un espejo invisible: el campo mide justo lo que escribe y el $ queda
  // pegado al monto, centrados juntos (en la web el <input> no se ajusta solo a su contenido).
  const [textWidth, setTextWidth] = useState<number | undefined>(undefined);
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
          style={[
            styles.input,
            textWidth === undefined ? null : { width: textWidth + theme.spacing[1] },
          ]}
        />
        <Text
          testID="hero-amount-mirror"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
          style={[styles.input, styles.mirror]}
        >
          {value || inputProps.placeholder || '0'}
        </Text>
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
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: theme.spacing[1],
    borderBottomWidth: 2,
    paddingVertical: theme.spacing[2],
    alignSelf: 'stretch',
  },
  prefix: { ...theme.typography.display, color: theme.colors.text.muted },
  // Sin flex ni estiramiento: el ancho sale del espejo. Sin relleno lateral (Android trae uno).
  input: {
    ...theme.typography.display,
    ...theme.amount,
    color: theme.colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  mirror: { position: 'absolute', opacity: 0 },
  disabled: { opacity: 0.5 },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
  error: { color: theme.colors.status.danger.fg },
});
