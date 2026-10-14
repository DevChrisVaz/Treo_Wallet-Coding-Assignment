import { digitsOnly } from '@devchrisvaz/wallet-contract';
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

/**
 * Código de 6 dígitos en un solo campo (MOB-12): solo dígitos al escribir y al pegar, máximo 6, teclado
 * numérico; lo ofrece el autocompletado del SO.
 */
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
      onChangeText={(text) => onChangeText(digitsOnly(text, 6))}
    />
  );
}

// Dígitos tabulares, como el código de la web (WEB-25 / DSG-09).
const styles = StyleSheet.create({
  code: { ...theme.amount, letterSpacing: theme.spacing[2] },
});
