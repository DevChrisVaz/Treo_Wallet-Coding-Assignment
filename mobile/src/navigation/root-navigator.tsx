import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useServices, useSessionSnapshot } from '@/app-services';
import { restoreSession } from '@/session/restore';
import { useScreenCaptureProtection } from '@/session/screen-capture';

import { StartupLoading, StartupOffline } from './startup-views';

export { StartupLoading } from './startup-views';

/**
 * Navegación raíz: restaura la sesión al arrancar y protege las rutas. Con sesión, solo el grupo
 * `(app)`; sin sesión (o revocada), solo el inicio de sesión (MOB-02, MOB-03).
 */
export function RootNavigator() {
  const { session, refresher } = useServices();
  const snapshot = useSessionSnapshot();
  useScreenCaptureProtection();
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
