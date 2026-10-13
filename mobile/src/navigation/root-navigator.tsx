import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useServices, useSessionSnapshot } from '@/app-services';
import { Button, Wordmark } from '@/components/ui';
import { restoreSession } from '@/session/restore';
import { theme } from '@/theme';

/**
 * Navegación raíz: restaura la sesión al arrancar y protege las rutas. Con sesión, solo el grupo
 * `(app)`; sin sesión (o revocada), solo el inicio de sesión (MOB-02, MOB-03).
 */
export function RootNavigator() {
  const { session, refresher } = useServices();
  const snapshot = useSessionSnapshot();
  // Cada intento de restaurar tiene un número; "Reintentar" inicia el siguiente.
  const [attempt, setAttempt] = useState(0);
  const [offlineAttempt, setOfflineAttempt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void restoreSession(session, refresher).then((outcome) => {
      if (active && outcome === 'offline') setOfflineAttempt(attempt);
    });
    return () => {
      active = false;
    };
  }, [session, refresher, attempt]);

  if (snapshot.status === 'unknown') {
    return offlineAttempt === attempt ? (
      <StartupOffline onRetry={() => setAttempt((current) => current + 1)} />
    ) : (
      <StartupLoading />
    );
  }

  const signedIn = snapshot.status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

function StartupLoading() {
  return (
    <View style={styles.container} accessibilityLabel="Cargando">
      <Wordmark />
      <ActivityIndicator color={theme.colors.action.primary} />
    </View>
  );
}

function StartupOffline({ onRetry }: { onRetry: () => void }) {
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
