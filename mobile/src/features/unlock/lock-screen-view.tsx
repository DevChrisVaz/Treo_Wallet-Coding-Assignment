import { StyleSheet, View } from 'react-native';

import { BrandScreen, Button, InlineAlert, type AlertTone } from '@/components/ui';
import { theme } from '@/theme';

import type { BiometricKind } from './biometrics';

export interface LockNotice {
  tone: AlertTone;
  message: string;
}

export interface LockScreenViewProps {
  /** Tipo de biometría del dispositivo; sin él (aún no se sabe), el botón dice "Desbloquear". */
  kind: BiometricKind | undefined;
  /** El diálogo biométrico está abierto: "Desbloquear" queda ocupado. */
  prompting: boolean;
  /** Aviso del último intento (bloqueo temporal o error), o nada. */
  notice: LockNotice | null;
  onUnlock: () => void;
  onSignOut: () => void;
}

/**
 * Vista de la pantalla de bloqueo (MOB-25, MOB-26): la marca, el aviso y las dos opciones, sin
 * saldos, movimientos ni datos personales. Pura: el contenedor (`lock-screen.tsx`) pide la biometría.
 */
export function LockScreenView({
  kind,
  prompting,
  notice,
  onUnlock,
  onSignOut,
}: LockScreenViewProps) {
  return (
    <BrandScreen title="TreoWallet está bloqueada">
      {notice ? <InlineAlert tone={notice.tone} message={notice.message} /> : null}
      <View style={styles.actions}>
        <Button
          label={kind ? `Desbloquear con ${kind}` : 'Desbloquear'}
          onPress={onUnlock}
          loading={prompting}
        />
        <Button label="Usar mi contraseña" variant="ghost" onPress={onSignOut} />
      </View>
    </BrandScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing[3] },
});
