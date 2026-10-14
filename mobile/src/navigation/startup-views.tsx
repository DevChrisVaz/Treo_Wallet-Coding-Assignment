import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Wordmark } from '@/components/ui';
import { theme } from '@/theme';

/** Arranque en curso: marca e indicador de carga, sin datos de la cuenta. */
export function StartupLoading() {
  return (
    <View style={styles.container} accessibilityLabel="Cargando">
      <Wordmark />
      <ActivityIndicator color={theme.colors.action.primary} />
    </View>
  );
}

export function StartupOffline({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Wordmark />
      <Text style={styles.title} accessibilityRole="header">
        No pudimos conectar con TreoWallet
      </Text>
      <Text style={styles.body}>Revisa tu conexión e intenta de nuevo.</Text>
      <Button label="Reintentar" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[6],
    backgroundColor: theme.colors.surface.default,
  },
  title: { ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' },
  body: { ...theme.typography.body, color: theme.colors.text.secondary, textAlign: 'center' },
});
