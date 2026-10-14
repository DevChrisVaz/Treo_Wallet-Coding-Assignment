import { ProblemError } from '@devchrisvaz/wallet-contract';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, InlineAlert, OtpField } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

import { UNCERTAIN_TITLE } from './attempt-actions';
import { MAX_RETRIES, type AttemptState, type TransferAttempt } from './transfer-attempt';

type OtpState = Extract<
  AttemptState,
  { status: 'pendingOtp' | 'confirmingOtp' | 'waitingOtpRetry' | 'otpUncertain' }
>;

/** Segundos que faltan para una fecha, actualizados cada segundo (orientativo: decide la API). */
function useSecondsUntil(iso: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

function minutesAndSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function attemptsText(attempts: number): string {
  return attempts === 1 ? 'Te queda 1 intento.' : `Te quedan ${attempts} intentos.`;
}

/**
 * Captura del código de 6 dígitos (MOB-12): correo enmascarado, tiempo restante, intentos que
 * quedan, reenvío y aviso cuando el correo no se pudo enviar. La confirmación sigue la misma
 * política de reintentos que la creación.
 */
export function OtpView({ attempt, state }: { attempt: TransferAttempt; state: OtpState }) {
  const [code, setCode] = useState('');
  const { otp } = state.transfer;
  const remaining = useSecondsUntil(otp?.expiresAt);
  const busy = state.status === 'confirmingOtp' || state.status === 'waitingOtpRetry';
  const pending = state.status === 'pendingOtp' ? state : undefined;
  const resendExhausted =
    pending?.resendError instanceof ProblemError &&
    pending.resendError.code === 'RESEND_LIMIT_REACHED';
  const canResend =
    state.status === 'pendingOtp' && !resendExhausted && (otp?.resendsRemaining ?? 0) > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        {`Te enviamos un código de 6 dígitos a ${otp?.maskedDestination ?? 'tu correo'}.`}
      </Text>
      {otp?.deliveryStatus === 'FAILED' ? (
        <InlineAlert
          tone="warning"
          message="No pudimos enviarte el código. Reenvíalo para recibir uno nuevo."
        />
      ) : null}
      <Text style={styles.meta}>
        {remaining > 0
          ? `El código vence en ${minutesAndSeconds(remaining)}.`
          : 'El tiempo para usar este código terminó.'}
      </Text>
      <Text style={styles.meta}>{attemptsText(otp?.attemptsRemaining ?? 0)}</Text>

      {pending?.otpError ? (
        <InlineAlert tone="danger" message={errorMessage(pending.otpError)} />
      ) : null}
      {pending?.resendError ? (
        <InlineAlert
          tone={resendExhausted ? 'warning' : 'danger'}
          message={errorMessage(pending.resendError)}
        />
      ) : null}
      {state.status === 'waitingOtpRetry' ? (
        <InlineAlert
          tone="warning"
          message={`Perdimos la conexión. Reintentaremos la confirmación (${state.retry} de ${MAX_RETRIES}).`}
        />
      ) : null}

      {state.status === 'otpUncertain' ? (
        <>
          <InlineAlert
            tone="warning"
            title={UNCERTAIN_TITLE}
            message="Puede que ya se haya confirmado. Reintenta para conocer el resultado."
          />
          <Button label="Reintentar" onPress={() => void attempt.retry()} />
        </>
      ) : (
        <>
          <OtpField value={code} onChangeText={setCode} disabled={busy} />
          <Button
            label="Confirmar"
            loading={busy}
            disabled={code.length !== 6}
            onPress={() => void attempt.confirmOtp(code)}
          />
          {canResend ? (
            <Button
              label="Reenviar código"
              variant="ghost"
              loading={pending?.resending ?? false}
              onPress={() => void attempt.resendOtp()}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[4] },
  body: { ...theme.typography.body, color: theme.colors.text.primary },
  meta: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
});
