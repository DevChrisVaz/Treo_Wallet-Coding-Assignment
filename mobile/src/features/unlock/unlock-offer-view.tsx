import { StyleSheet, Text, View } from 'react-native';

import { Button, ListSection } from '@/components/ui';
import { theme } from '@/theme';

import type { BiometricKind } from './biometrics';

export interface UnlockOfferViewProps {
  kind: BiometricKind;
  /** El diálogo biométrico de "Activar" está abierto. */
  activating: boolean;
  onActivate: () => void;
  onDecline: () => void;
}

/**
 * Vista de la oferta del desbloqueo (MOB-24): una tarjeta del kit (DSG-17) cuyo título es el
 * encabezado "Entrar con tu <tipo>". Pura: el contenedor (`unlock-offer.tsx`) decide si aparece y
 * guarda la respuesta.
 */
export function UnlockOfferView({ kind, activating, onActivate, onDecline }: UnlockOfferViewProps) {
  return (
    <ListSection title={`Entrar con tu ${kind}`}>
      <View style={styles.body}>
        <Text style={styles.text}>
          {`Abre TreoWallet con tu ${kind}, sin escribir tu contraseña.`}
        </Text>
        <Button label="Activar" onPress={onActivate} loading={activating} />
        <Button label="Ahora no" variant="ghost" onPress={onDecline} disabled={activating} />
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing[3] },
  text: { ...theme.typography.body, color: theme.colors.text.secondary },
});
