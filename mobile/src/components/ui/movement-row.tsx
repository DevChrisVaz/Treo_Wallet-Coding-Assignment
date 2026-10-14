import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { movementIcon } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatTime, movementPresentation } from '@/lib/display';
import { theme } from '@/theme';

import { Avatar } from './avatar';

interface MovementRowProps {
  movement: Movement;
  /**
   * Para listas que ya agrupan por día (MovementList, MOB-20): solo la hora a la vista y sin borde
   * propio, porque la lista pone los divisores. Por omisión, la fecha completa y el borde inferior,
   * como en las listas planas.
   */
  timeOnly?: boolean;
}

/**
 * Movimiento: avatar por tipo, etiqueta, contraparte y concepto, fecha (u hora, con `timeOnly`) y
 * referencia, monto y saldo.
 */
export function MovementRow({ movement, timeOnly = false }: MovementRowProps) {
  const { label, amountText, color, direction } = movementPresentation(
    movement.type,
    movement.amount,
  );
  const detail = movement.counterparty
    ? `${movement.counterparty.name} · ${movement.concept}`
    : movement.concept;
  const dateTime = formatDateTime(movement.occurredAt);
  const reference = `Ref. ${movement.reference}`;
  return (
    <View testID="movement-row" style={[styles.row, timeOnly ? null : styles.separated]}>
      <View testID="movement-avatar">
        <Avatar
          tone={direction === 'in' ? 'success' : 'neutral'}
          icon={movementIcon[movement.type]}
        />
      </View>
      <View style={styles.main}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
        {/* La etiqueta reemplaza al texto para los lectores de pantalla: lleva la fecha y la referencia. */}
        <Text style={styles.caption} accessibilityLabel={`${dateTime} · ${reference}`}>
          {`${timeOnly ? formatTime(movement.occurredAt) : dateTime} · ${reference}`}
        </Text>
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
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[3],
  },
  separated: { borderBottomWidth: 1, borderBottomColor: theme.colors.border.default },
  main: { flex: 1, gap: theme.spacing[1] },
  amounts: { alignItems: 'flex-end', gap: theme.spacing[1] },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  detail: { ...theme.typography.caption, color: theme.colors.text.secondary },
  caption: { ...theme.typography.caption, ...theme.amount, color: theme.colors.text.muted },
  amount: { ...theme.typography.label, ...theme.amount },
});
