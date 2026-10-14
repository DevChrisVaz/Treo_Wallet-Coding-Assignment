import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateTime, movementPresentation } from '@/lib/display';
import { theme } from '@/theme';

/** Movimiento: etiqueta del tipo, contraparte, concepto, fecha, monto con signo y saldo. */
export function MovementRow({ movement }: { movement: Movement }) {
  const { label, amountText, color } = movementPresentation(movement.type, movement.amount);
  const detail = movement.counterparty
    ? `${movement.counterparty.name} · ${movement.concept}`
    : movement.concept;
  return (
    <View testID="movement-row" style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
        <Text style={styles.caption}>{formatDateTime(movement.occurredAt)}</Text>
      </View>
      <View style={styles.amounts}>
        <Text style={[styles.amount, { color }]}>{amountText}</Text>
        <Text style={styles.caption}>{`Saldo ${formatMXN(movement.balanceAfter)}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  main: { flex: 1, gap: theme.spacing[1] },
  amounts: { alignItems: 'flex-end', gap: theme.spacing[1] },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  detail: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  caption: { ...theme.typography.caption, ...theme.amount, color: theme.colors.text.muted },
  amount: { ...theme.typography.label, ...theme.amount },
});
