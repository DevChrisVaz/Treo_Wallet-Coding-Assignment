import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useServices } from '@/app-services';
import { theme } from '@/theme';

import { requestUnlock, useBiometricSupport, type BiometricKind } from './biometrics';
import { useUnlockPreference } from './use-unlock-preference';

/** Qué registrar en los ajustes del teléfono para poder usar el desbloqueo (diseño D6). */
const EXPLANATIONS: Record<BiometricKind, string> = {
  huella: 'Registra una huella en los ajustes de tu teléfono para usar esta opción.',
  rostro: 'Registra tu rostro en los ajustes de tu teléfono para usar esta opción.',
  biometría: 'Registra una huella o tu rostro en los ajustes de tu teléfono para usar esta opción.',
};

/**
 * Interruptor "Desbloqueo con <tipo>" de la pantalla de inicio (MOB-24, MOB-27, diseño D6).
 * Encenderlo exige la autenticación biométrica; apagarlo borra la preferencia sin pedirla y sin
 * cerrar la sesión. Sin biometría registrada aparece deshabilitado con la explicación, que también
 * llega al lector de pantalla.
 */
export function UnlockSwitch() {
  const { unlockPreference } = useServices();
  const preference = useUnlockPreference();
  const support = useBiometricSupport();
  const [busy, setBusy] = useState(false);

  if (!support) return null;

  const label = `Desbloqueo con ${support.kind}`;
  const explanation = support.available ? undefined : EXPLANATIONS[support.kind];
  const disabled = !support.available || busy;

  async function change(on: boolean) {
    setBusy(true);
    try {
      if (!on) {
        await unlockPreference.clear();
      } else if ((await requestUnlock('Activa el desbloqueo de TreoWallet')) === 'success') {
        await unlockPreference.save('enabled');
      }
    } catch {
      // Sin almacenamiento seguro, el interruptor se queda como estaba.
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={explanation}
        // En iOS, React Native no pasa `disabled` al estado de accesibilidad del interruptor.
        accessibilityState={{ disabled }}
        value={preference === 'enabled'}
        onValueChange={(on) => void change(on)}
        disabled={disabled}
        trackColor={{ false: theme.colors.border.input, true: theme.colors.action.primary }}
        thumbColor={theme.colors.surface.default}
        ios_backgroundColor={theme.colors.border.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    minHeight: theme.touchTarget,
  },
  text: { flex: 1, gap: theme.spacing[1] },
  label: { ...theme.typography.label, color: theme.colors.text.primary },
  explanation: { ...theme.typography.caption, color: theme.colors.text.secondary },
});
