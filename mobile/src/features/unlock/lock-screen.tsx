import { useEffect, useEffectEvent, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/ui';
import { theme } from '@/theme';

import { requestUnlock, type UnlockResult } from './biometrics';

interface LockScreenProps {
  onUnlock: () => void;
}

/**
 * Pantalla de bloqueo (MOB-25, diseño D5): sin saldos, movimientos ni datos personales. Pide la
 * biometría una sola vez al aparecer.
 */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const prompted = useRef(false);
  const mounted = useRef(false);

  // Un resultado que llega después de desmontar la pantalla ya no aplica.
  const handleResult = useEffectEvent((result: UnlockResult) => {
    if (mounted.current && result === 'success') onUnlock();
  });

  useEffect(() => {
    mounted.current = true;
    if (!prompted.current) {
      prompted.current = true;
      void requestUnlock().then(handleResult);
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Wordmark />
      <Text style={styles.title} accessibilityRole="header">
        TreoWallet está bloqueada
      </Text>
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
});
