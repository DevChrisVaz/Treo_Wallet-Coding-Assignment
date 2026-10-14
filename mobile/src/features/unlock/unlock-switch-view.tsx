import { StyleSheet, Switch, Text, View } from 'react-native';

import { theme } from '@/theme';

import type { BiometricKind } from './biometrics';

/** Qué registrar en los ajustes del teléfono para poder usar el desbloqueo (diseño D6). */
const EXPLANATIONS: Record<BiometricKind, string> = {
  huella: 'Registra una huella en los ajustes de tu teléfono para usar esta opción.',
  rostro: 'Registra tu rostro en los ajustes de tu teléfono para usar esta opción.',
  biometría: 'Registra una huella o tu rostro en los ajustes de tu teléfono para usar esta opción.',
};

/**
 * En el teléfono `thumbColor` vale para los dos estados; react-native-web (Expo web y el lienzo de
 * diseño) pinta el encendido con `activeThumbColor`, que por omisión es #009688, fuera de los tokens.
 * React Native no lo tipa, así que va aparte y se esparce.
 */
const WEB_THUMB = { activeThumbColor: theme.colors.surface.default };

export interface UnlockSwitchViewProps {
  kind: BiometricKind;
  /** Hay biometría registrada; sin ella, el interruptor se deshabilita con la explicación. */
  available: boolean;
  /** El desbloqueo está activo. */
  enabled: boolean;
  /** Un cambio en curso (diálogo biométrico o almacenamiento): no acepta otro. */
  busy: boolean;
  onChange: (on: boolean) => void;
}

/**
 * Vista del interruptor "Desbloqueo con <tipo>" (MOB-24, MOB-27) que va en el menú de la cuenta, junto
 * a "Cerrar sesión" (R46). Sin biometría registrada aparece deshabilitado con la explicación, que
 * también llega al lector de pantalla. Pura: el contenedor (`unlock-switch.tsx`) guarda la preferencia.
 */
export function UnlockSwitchView({
  kind,
  available,
  enabled,
  busy,
  onChange,
}: UnlockSwitchViewProps) {
  const label = `Desbloqueo con ${kind}`;
  const explanation = available ? undefined : EXPLANATIONS[kind];
  const disabled = !available || busy;
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
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.border.input, true: theme.colors.action.primary }}
        thumbColor={theme.colors.surface.default}
        {...WEB_THUMB}
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
