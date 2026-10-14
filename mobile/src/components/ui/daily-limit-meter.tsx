import { formatMXN, type DailyLimit } from '@devchrisvaz/wallet-contract';
import { StyleSheet, Text, View } from 'react-native';

import { limitUsedPercent } from '@/lib/display';
import { theme } from '@/theme';

type DailyLimitMeterProps = { dailyLimit: Pick<DailyLimit, 'limit' | 'used' | 'remaining'> };

/** Medidor del límite diario: barra de lo usado y "Te quedan $X hoy" (DSG-11, MOB-05). */
export function DailyLimitMeter({ dailyLimit }: DailyLimitMeterProps) {
  const percent = limitUsedPercent(dailyLimit);
  const text = `Te quedan ${formatMXN(dailyLimit.remaining)} hoy`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Límite diario usado"
      accessibilityValue={{ min: 0, max: 100, now: percent, text }}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Límite diario</Text>
        <Text style={styles.limit}>{formatMXN(dailyLimit.limit)}</Text>
      </View>
      <View style={styles.track}>
        <View testID="daily-limit-fill" style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[2] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...theme.typography.label, color: theme.colors.text.primary },
  limit: { ...theme.typography.caption, ...theme.amount, color: theme.colors.text.muted },
  track: {
    height: theme.spacing[2],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.status.neutral.bg,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.colors.accent.brand },
  text: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
});
