import type { TransferStatus } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { statusPresentation } from '@/lib/display';
import { theme } from '@/theme';

/** Insignia del estado de una transferencia; el color siempre va con la etiqueta (DSG-10). */
export function StatusBadge({ status }: { status: TransferStatus }) {
  const { label, colors } = statusPresentation(status);
  return (
    <View testID="status-badge" style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  label: { ...theme.typography.caption, fontFamily: theme.typography.label.fontFamily },
});
