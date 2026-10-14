import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { InlineAlert, ListSection } from '@/components/ui';
import { maskClabe } from '@/lib/display';
import { theme } from '@/theme';

import { requiresOtp } from './flow-steps';
import type { TransferDraft } from './transfer-attempt';

interface ReviewViewProps {
  draft: TransferDraft;
  account: Account | undefined;
  beneficiary: Beneficiary | undefined;
}

function SummaryRow({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.row, first ? null : styles.divider]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.fill} />
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

/** Monto protagonista de la revisión y del código, con una línea opcional debajo. */
export function AmountBlock({ amount, caption }: { amount: string; caption?: string }) {
  return (
    <View style={styles.amountBlock}>
      <Text style={styles.amountLabel}>Monto</Text>
      <Text style={styles.amount}>{formatMXN(amount)}</Text>
      {caption ? <Text style={styles.amountCaption}>{caption}</Text> : null}
    </View>
  );
}

/**
 * Resumen de la transferencia antes y durante el envío (MOB-09): el monto como protagonista y los
 * datos congelados del intento; arriba de $10,000.00 avisa que pedirá un código.
 */
export function ReviewView({ draft, account, beneficiary }: ReviewViewProps) {
  return (
    <>
      <AmountBlock amount={draft.amount} />
      <ListSection>
        <SummaryRow
          first
          label="Desde"
          value={account ? `${account.name} · ${maskClabe(account.clabe)}` : ''}
        />
        <SummaryRow
          label="Para"
          value={beneficiary ? `${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}` : ''}
        />
        <SummaryRow label="Concepto" value={draft.concept} />
        <SummaryRow label="Referencia" value={draft.reference} />
      </ListSection>
      {requiresOtp(draft.amount) ? (
        <InlineAlert
          tone="info"
          message={`Como el monto es mayor a ${formatMXN('10000.00')}, te enviaremos un código de confirmación a tu correo.`}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: theme.touchTarget,
    paddingVertical: theme.spacing[3],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  summaryLabel: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  // Dígitos tabulares, como el resumen de la web (CLABE y referencia alineadas).
  summaryValue: {
    ...theme.typography.label,
    ...theme.amount,
    flexShrink: 1,
    color: theme.colors.text.primary,
    textAlign: 'right',
  },
  amountBlock: { alignItems: 'center', gap: theme.spacing[1], paddingVertical: theme.spacing[2] },
  amountLabel: { ...theme.typography.label, color: theme.colors.text.secondary },
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  amountCaption: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
});
