import { loginForm, ProblemError } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { retryAfterSeconds } from '@/api/client';
import { useServices, useSessionSnapshot } from '@/app-services';
import { Screen } from '@/components/screen';
import { Button, InlineAlert, TextField, Wordmark, type AlertTone } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { fieldErrorsByName, zodFieldErrors } from '@/lib/field-errors';
import { useCountdown } from '@/lib/use-countdown';
import { theme } from '@/theme';

interface Alert {
  tone: AlertTone;
  message: string;
}

/**
 * Inicio de sesión (MOB-01): sin registro ni verificación de correo, que se hacen en la web. Estados:
 * enviando, error genérico de credenciales, correo sin verificar y bloqueo por `429` con cuenta
 * regresiva de `Retry-After`.
 */
export function LoginScreen() {
  const { api, session } = useServices();
  const snapshot = useSessionSnapshot();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<Alert | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useCountdown();

  const revoked = snapshot.status === 'signedOut' && snapshot.reason === 'revoked';
  const shownAlert: Alert | null =
    alert ?? (revoked ? { tone: 'warning', message: problemMessage('SESSION_REVOKED') } : null);

  async function submit() {
    if (submitting || lock.remaining > 0) return;
    const parsed = loginForm.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setAlert(null);
    setSubmitting(true);
    try {
      const { data } = await api.POST('/auth/login', { body: parsed.data });
      if (data) await session.start(data.tokens);
    } catch (error) {
      setAlert(alertFor(error));
      if (error instanceof ProblemError) {
        if (error.code === 'INVALID_CREDENTIALS') setPassword('');
        if (error.code === 'VALIDATION_FAILED' && error.errors) {
          setFieldErrors(fieldErrorsByName(error.errors));
        }
        const seconds = retryAfterSeconds(error);
        if (error.code === 'RATE_LIMITED' && seconds) lock.start(seconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Wordmark />
        <Text style={styles.title} accessibilityRole="header">
          Inicia sesión
        </Text>
        <Text style={styles.subtitle}>Usa el correo y la contraseña de tu cuenta TreoWallet.</Text>
      </View>

      {shownAlert ? <InlineAlert tone={shownAlert.tone} message={shownAlert.message} /> : null}

      <TextField
        label="Correo"
        variant="email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        returnKeyType="next"
      />
      <TextField
        label="Contraseña"
        variant="password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {lock.remaining > 0 ? (
        <Text style={styles.countdown} accessibilityLiveRegion="polite">
          {`Podrás intentar de nuevo en ${lock.remaining} s.`}
        </Text>
      ) : null}

      <Button
        label="Iniciar sesión"
        onPress={() => void submit()}
        loading={submitting}
        disabled={lock.remaining > 0}
      />

      <Text style={styles.note}>
        ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de
        TreoWallet.
      </Text>
    </Screen>
  );
}

function alertFor(error: unknown): Alert {
  if (error instanceof ProblemError) {
    switch (error.code) {
      case 'EMAIL_NOT_VERIFIED':
        return {
          tone: 'warning',
          message: `${problemMessage('EMAIL_NOT_VERIFIED')} La verificación se completa en la web de TreoWallet.`,
        };
      case 'RATE_LIMITED':
        return { tone: 'warning', message: errorMessage(error) };
      default:
        return { tone: 'danger', message: errorMessage(error) };
    }
  }
  return { tone: 'danger', message: errorMessage(error) };
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[2], paddingTop: theme.spacing[8] },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  subtitle: { ...theme.typography.body, color: theme.colors.text.secondary },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
});
