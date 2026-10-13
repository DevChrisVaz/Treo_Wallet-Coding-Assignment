import { TextField, type TextFieldProps } from './text-field';

type AmountFieldProps = Omit<TextFieldProps, 'variant' | 'prefix' | 'keyboardType'>;

/**
 * Campo de monto: prefijo `$`, teclado decimal y valor como string. Quita espacios y comas al
 * escribir o pegar; nunca convierte a número (MOB-08, MOB-15). La validación la hace el formulario
 * con `amountInput` del contrato.
 */
export function AmountField({ onChangeText, ...props }: AmountFieldProps) {
  return (
    <TextField
      {...props}
      prefix="$"
      keyboardType="decimal-pad"
      inputMode="decimal"
      autoCorrect={false}
      onChangeText={(text) => onChangeText(text.replace(/[\s,]/g, ''))}
    />
  );
}
