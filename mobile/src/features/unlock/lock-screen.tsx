import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, InlineAlert, Wordmark, type AlertTone } from '@/components/ui';
import { theme } from '@/theme';

import { requestUnlock, useBiometricSupport, type UnlockResult } from './biometrics';

interface LockScreenProps {
  onUnlock: () => void;
  /** "Usar mi contraseña", o el dispositivo ya no tiene biometría registrada (MOB-26). */
  onSignOut: () => void;
}

interface Notice {
  tone: AlertTone;
  message: string;
}

const LOCKOUT: Notice = {
  tone: 'warning',
  message: 'Demasiados intentos. Intenta más tarde o usa tu contraseña.',
};

const FAILED: Notice = {
  tone: 'danger',
  message: 'No pudimos verificar tu identidad. Intenta de nuevo o usa tu contraseña.',
};

/**
 * Pantalla de bloqueo (MOB-25, MOB-26, diseño D5): la marca, el aviso y las dos opciones, sin
 * saldos, movimientos ni datos personales. Pide la biometría una sola vez al aparecer; después,
 * solo con "Desbloquear", para no encadenar diálogos si la persona cancela.
 */
export function LockScreen({ onUnlock, onSignOut }: LockScreenProps) {
  const support = useBiometricSupport();
  // Empieza pidiendo: el diálogo se abre al aparecer la pantalla.
  const [prompting, setPrompting] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const prompted = useRef(false);
  const mounted = useRef(false);

  function settle(result: UnlockResult) {
    // Un resultado que llega después de desmontar la pantalla ya no aplica.
    if (!mounted.current) return;
    setPrompting(false);
    switch (result) {
      case 'success':
        onUnlock();
        break;
      case 'cancelled':
        break;
      case 'lockout':
        setNotice(LOCKOUT);
        break;
      case 'unavailable':
        onSignOut();
        break;
      case 'error':
        setNotice(FAILED);
        break;
    }
  }

  const settleFirstPrompt = useEffectEvent(settle);

  useEffect(() => {
    mounted.current = true;
    if (!prompted.current) {
      prompted.current = true;
      void requestUnlock().then(settleFirstPrompt);
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  async function unlock() {
    setPrompting(true);
    setNotice(null);
    settle(await requestUnlock());
  }

  return (
    <View style={styles.container}>
      <Wordmark />
      <Text style={styles.title} accessibilityRole="header">
        TreoWallet está bloqueada
      </Text>
      {notice ? <InlineAlert tone={notice.tone} message={notice.message} /> : null}
      <View style={styles.actions}>
        <Button
          label={support ? `Desbloquear con ${support.kind}` : 'Desbloquear'}
          onPress={() => void unlock()}
          loading={prompting}
        />
        <Button label="Usar mi contraseña" variant="ghost" onPress={onSignOut} />
      </View>
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
  actions: { alignSelf: 'stretch', gap: theme.spacing[3] },
});
