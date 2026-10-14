import { toneIcon } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

export type AlertTone = 'success' | 'warning' | 'danger' | 'info';

interface InlineAlertProps {
  tone: AlertTone;
  message: string;
  title?: string;
}

/** Mensaje en línea. Los errores se anuncian como alerta; el resto, sin interrumpir (DSG-11). */
export function InlineAlert({ tone, message, title }: InlineAlertProps) {
  const colors = theme.colors.status[tone];
  const isError = tone === 'danger';
  return (
    <View
      testID="inline-alert"
      accessible
      accessibilityRole={isError ? 'alert' : 'none'}
      accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
      style={[styles.alert, { backgroundColor: colors.bg }]}
    >
      <View testID="inline-alert-icon">
        <Icon name={toneIcon[tone]} color={colors.fg} />
      </View>
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: colors.fg }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: colors.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.spacing[3],
    padding: theme.spacing[4],
  },
  body: { flex: 1, gap: theme.spacing[1] },
  title: { ...theme.typography.label },
  message: { ...theme.typography.bodySm },
});
