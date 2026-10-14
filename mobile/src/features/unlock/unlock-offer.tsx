import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/app-services';
import { Button, ListSection } from '@/components/ui';
import { theme } from '@/theme';

import { requestUnlock, useBiometricSupport } from './biometrics';
import { useUnlockPreference } from './use-unlock-preference';

/**
 * Oferta del desbloqueo biométrico (MOB-24, diseño D6): una tarjeta en la pantalla de inicio, y no
 * un diálogo modal, para no interrumpir y ser accesible con el lector de pantalla. Aparece después
 * de un inicio de sesión con contraseña, si la persona no ha respondido en este dispositivo y hay
 * biometría registrada. "Activar" lo activa solo si la autenticación biométrica tiene éxito; "Ahora
 * no" se guarda hasta el siguiente cierre de sesión (MOB-27).
 */
export function UnlockOffer() {
  const { unlockPreference } = useServices();
  const preference = useUnlockPreference();
  const offerPending = useSyncExternalStore(
    unlockPreference.subscribe,
    unlockPreference.isOfferPending,
  );
  const support = useBiometricSupport();
  const [activating, setActivating] = useState(false);

  if (!offerPending || preference !== null || !support?.available) return null;

  async function activate() {
    setActivating(true);
    try {
      const result = await requestUnlock('Activa el desbloqueo de TreoWallet');
      if (result === 'success') await unlockPreference.save('enabled');
    } catch {
      // Sin almacenamiento seguro, el desbloqueo sigue inactivo y la oferta sigue a la vista.
    } finally {
      setActivating(false);
    }
  }

  function decline() {
    unlockPreference.save('declined').catch(() => undefined);
  }

  // Tarjeta del kit (DSG-17): su título es el encabezado "Entrar con tu <tipo>".
  return (
    <ListSection title={`Entrar con tu ${support.kind}`}>
      <View style={styles.body}>
        <Text style={styles.text}>
          {`Abre TreoWallet con tu ${support.kind}, sin escribir tu contraseña.`}
        </Text>
        <Button label="Activar" onPress={() => void activate()} loading={activating} />
        <Button label="Ahora no" variant="ghost" onPress={decline} disabled={activating} />
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing[3] },
  text: { ...theme.typography.body, color: theme.colors.text.secondary },
});
