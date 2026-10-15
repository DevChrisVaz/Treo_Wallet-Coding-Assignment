import { loginForm, ProblemError } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { useState } from 'react';

import { useServices, useSessionSnapshot } from '@/app-services';
import type { AlertTone } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { fieldErrorsByName, zodFieldErrors } from '@/lib/field-errors';
import { useCountdown } from '@/lib/use-countdown';

import { LoginView } from './login-view';

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
  const { api, session, unlockPreference } = useServices();
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
      if (data) {
        // Después de un inicio de sesión con contraseña se ofrece el desbloqueo biométrico (MOB-24).
        unlockPreference.offerAfterLogin();
        await session.start(data.tokens);
      }
    } catch (error) {
      setAlert(alertFor(error));
      if (error instanceof ProblemError) {
        if (error.code === 'INVALID_CREDENTIALS') setPassword('');
        if (error.code === 'VALIDATION_FAILED' && error.errors) {
          setFieldErrors(fieldErrorsByName(error.errors));
        }
        if (error.code === 'RATE_LIMITED' && error.retryAfter) lock.start(error.retryAfter);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginView
      email={email}
      password={password}
      fieldErrors={fieldErrors}
      alert={shownAlert}
      lockRemaining={lock.remaining}
      submitting={submitting}
      onChangeEmail={setEmail}
      onChangePassword={setPassword}
      onSubmit={() => void submit()}
    />
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
      // MOB-30: el registro quedó en revisión; no hay sesión que guardar.
      case 'REGISTRATION_IN_REVIEW':
        return { tone: 'info', message: errorMessage(error) };
      case 'RATE_LIMITED':
        return { tone: 'warning', message: errorMessage(error) };
      default:
        return { tone: 'danger', message: errorMessage(error) };
    }
  }
  return { tone: 'danger', message: errorMessage(error) };
}
