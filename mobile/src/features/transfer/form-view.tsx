import { formatMXN, type Account } from '@devchrisvaz/wallet-contract';
import { StyleSheet, View } from 'react-native';

import { AmountField, Button, Select, TextField } from '@/components/ui';
import { maskClabe } from '@/lib/display';
import { theme } from '@/theme';

export interface FormValues {
  fromAccountId: string | undefined;
  amount: string;
  concept: string;
  reference: string;
}

interface FormViewProps {
  accounts: Account[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (values: FormValues) => void;
  onContinue: () => void;
}

/**
 * Captura de la transferencia (MOB-08): cuenta de origen, monto, concepto y referencia. La
 * validación es la del contrato y la hace `TransferAttempt.review`; el monto queda como string.
 */
export function FormView({ accounts, values, errors, onChange, onContinue }: FormViewProps) {
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch });
  return (
    <View style={styles.form}>
      <Select
        label="Cuenta de origen"
        placeholder="Elige una cuenta"
        options={accounts.map((account) => ({
          value: account.id,
          label: account.name,
          description: `CLABE ${maskClabe(account.clabe)} · ${formatMXN(account.balance)}`,
        }))}
        value={values.fromAccountId}
        onChange={(fromAccountId) => set({ fromAccountId })}
        error={errors.fromAccountId}
      />
      <AmountField
        label="Monto"
        value={values.amount}
        onChangeText={(amount) => set({ amount })}
        error={errors.amount}
        help="Hasta 2 decimales, sin comas."
      />
      <TextField
        label="Concepto"
        value={values.concept}
        onChangeText={(concept) => set({ concept })}
        error={errors.concept}
        help="De 1 a 40 caracteres."
      />
      <TextField
        label="Referencia"
        value={values.reference}
        onChangeText={(reference) => set({ reference })}
        error={errors.reference}
        help="De 1 a 7 dígitos."
        keyboardType="number-pad"
        inputMode="numeric"
      />
      <Button label="Continuar" onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[4] },
});
