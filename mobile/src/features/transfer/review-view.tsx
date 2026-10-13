import { formatMXN, toCents, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { Button, InlineAlert } from '@/components/ui';
import { maskClabe } from '@/lib/display';
import { theme } from '@/theme';

import type { TransferDraft } from './transfer-attempt';

interface ReviewViewProps {
  draft: TransferDraft;
  account: Account | undefined;
  beneficiary: Beneficiary | undefined;
  sending: boolean;
  onSend: () => void;
  onEdit: () => void;
}

/** Montos mayores a 10,000.00 MXN piden un código por correo (HU6). */
const OTP_THRESHOLD_CENTS = toCents('10000.00');

export function requiresOtp(amount: string): boolean {
  return toCents(amount) > OTP_THRESHOLD_CENTS;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** Confirmación previa al envío (MOB-09). */
export function ReviewView({
  draft,
  account,
  beneficiary,
  sending,
  onSend,
  onEdit,
}: ReviewViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.amount}>{formatMXN(draft.amount)}</Text>
      <View style={styles.summary}>
        <Row label="Desde" value={account ? `${account.name} · ${maskClabe(account.clabe)}` : ''} />
        <Row
          label="Para"
          value={beneficiary ? `${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}` : ''}
        />
        <Row label="Concepto" value={draft.concept} />
        <Row label="Referencia" value={draft.reference} />
      </View>
      {requiresOtp(draft.amount) ? (
        <InlineAlert
          tone="info"
          message={`Como el monto es mayor a ${formatMXN('10000.00')}, te enviaremos un código de confirmación a tu correo.`}
        />
      ) : null}
      <Button label="Enviar" onPress={onSend} loading={sending} />
      {!sending ? <Button label="Editar" variant="ghost" onPress={onEdit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[4] },
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  summary: {
    gap: theme.spacing[3],
    padding: theme.spacing[5],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface.subtle,
  },
  row: { gap: theme.spacing[1] },
  rowLabel: { ...theme.typography.caption, color: theme.colors.text.secondary },
  rowValue: { ...theme.typography.body, color: theme.colors.text.primary },
});
