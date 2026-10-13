import { StyleSheet } from 'react-native';

import { theme } from '@/theme';

import { TextField } from './text-field';

interface OtpFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  error?: string | undefined;
  help?: string | undefined;
  disabled?: boolean;
}

/** Código de 6 dígitos en un solo campo; acepta pegarlo y lo ofrece el autocompletado del SO. */
export function OtpField({ label = 'Código de 6 dígitos', onChangeText, ...props }: OtpFieldProps) {
  return (
    <TextField
      {...props}
      label={label}
      keyboardType="number-pad"
      inputMode="numeric"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      inputStyle={styles.code}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
    />
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: theme.spacing[2] },
});
