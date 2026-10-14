import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { AmountField, Avatar, ListSection, Select, TextField, initials } from '@/components/ui';
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
  beneficiary: Beneficiary | undefined;
  values: FormValues;
  errors: Record<string, string>;
  onChange: (values: FormValues) => void;
}

/**
 * Captura de la transferencia (MOB-08, MOB-21): a quién se envía, el monto como protagonista,
 * cuenta de origen, concepto y referencia. La validación es la del contrato y la hace
 * `TransferAttempt.review`; el monto queda como string. "Continuar" va en el pie del paso.
 */
export function FormView({ accounts, beneficiary, values, errors, onChange }: FormViewProps) {
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch });
  return (
    <View style={styles.form}>
      {beneficiary ? (
        <ListSection>
          <View style={styles.row}>
            <Avatar initials={initials(beneficiary.name)} />
            <View style={styles.rowText}>
              <Text style={styles.rowDetail}>Para</Text>
              <Text style={styles.rowTitle}>
                {`${beneficiary.alias} · CLABE ${maskClabe(beneficiary.clabe)}`}
              </Text>
            </View>
          </View>
        </ListSection>
      ) : null}
      <AmountField
        variant="hero"
        label="Monto"
        value={values.amount}
        onChangeText={(amount) => set({ amount })}
        error={errors.amount}
        help="Hasta 2 decimales, sin comas."
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[4] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: theme.touchTarget,
    paddingVertical: theme.spacing[3],
  },
  rowText: { flex: 1, minWidth: 0, gap: theme.spacing[1] },
  rowTitle: { ...theme.typography.label, color: theme.colors.text.primary },
  rowDetail: { ...theme.typography.caption, color: theme.colors.text.secondary },
});
