import { StyleSheet, Text, View } from 'react-native';

import { BrandScreen, Button, InlineAlert, TextField, type AlertTone } from '@/components/ui';
import { theme } from '@/theme';

export interface LoginViewProps {
  email: string;
  password: string;
  fieldErrors: Record<string, string>;
  alert: { tone: AlertTone; message: string } | null;
  /** Segundos de bloqueo tras un 429 (MOB-01). */
  lockRemaining: number;
  submitting: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
}

/** Inicio de sesión sobre la superficie de marca (MOB-22): el formulario en una hoja blanca. */
export function LoginView({
  email,
  password,
  fieldErrors,
  alert,
  lockRemaining,
  submitting,
  onChangeEmail,
  onChangePassword,
  onSubmit,
}: LoginViewProps) {
  return (
    <BrandScreen title="Inicia sesión">
      {alert ? <InlineAlert tone={alert.tone} message={alert.message} /> : null}
      <View style={styles.form}>
        <TextField
          label="Correo"
          variant="email"
          value={email}
          onChangeText={onChangeEmail}
          error={fieldErrors.email}
          returnKeyType="next"
        />
        <TextField
          label="Contraseña"
          variant="password"
          value={password}
          onChangeText={onChangePassword}
          error={fieldErrors.password}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
        {lockRemaining > 0 ? (
          <Text style={styles.countdown} accessibilityLiveRegion="polite">
            {`Podrás intentar de nuevo en ${lockRemaining} s.`}
          </Text>
        ) : null}
        <Button
          label="Iniciar sesión"
          onPress={onSubmit}
          loading={submitting}
          disabled={lockRemaining > 0}
        />
      </View>
      <Text style={styles.note}>
        ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de
        TreoWallet.
      </Text>
    </BrandScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[4] },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
});
