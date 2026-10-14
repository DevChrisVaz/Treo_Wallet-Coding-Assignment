import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { PrivacyOverlay } from '@/components/ui';

/**
 * Privacidad en segundo plano (MOB-16, diseño 8): con `inactive` (iOS, selector de apps) o
 * `background`, tapa todo con la pantalla de privacidad y oculta el contenido a los lectores de
 * pantalla; con `active`, la retira y queda la misma pantalla. En Android, la miniatura del
 * selector se protege además con `expo-screen-capture` (tarea 5.2).
 */
export function PrivacyGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppStateStatus>(() => AppState.currentState ?? 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);

  const covered = state === 'inactive' || state === 'background';
  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={covered}
      >
        {children}
      </View>
      {covered ? <PrivacyOverlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
