import { ProblemError } from '@devchrisvaz/wallet-contract';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { InlineAlert, OtpField } from '@/components/ui';
import { maskClabe } from '@/lib/display';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

import { UNCERTAIN_TITLE } from './flow-steps';
import { MAX_RETRIES } from './retry-limits';
import { AmountBlock } from './review-view';
import type { AttemptState } from './transfer-attempt';

export type OtpState = Extract<
  AttemptState,
  { status: 'pendingOtp' | 'confirmingOtp' | 'waitingOtpRetry' | 'otpUncertain' }
>;

/** El último reenvío falló porque ya no quedan reenvíos (`RESEND_LIMIT_REACHED`). */
function resendExhausted(state: OtpState): boolean {
  return (
    state.status === 'pendingOtp' &&
    state.resendError instanceof ProblemError &&
    state.resendError.code === 'RESEND_LIMIT_REACHED'
  );
}

/** Lo que necesitan las acciones del pie en el paso de código. */
export function otpControls(state: OtpState): {
  busy: boolean;
  canResend: boolean;
  resending: boolean;
} {
  const busy = state.status === 'confirmingOtp' || state.status === 'waitingOtpRetry';
  const pending = state.status === 'pendingOtp' ? state : undefined;
  const canResend =
    state.status === 'pendingOtp' &&
    !resendExhausted(state) &&
    (state.transfer.otp?.resendsRemaining ?? 0) > 0;
  return { busy, canResend, resending: pending?.resending ?? false };
}

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

interface OtpViewProps {
  state: OtpState;
  /** El código vive en la pantalla: "Confirmar" va en el pie del paso. */
  code: string;
  onCodeChange: (code: string) => void;
}

/**
 * Captura del código de 6 dígitos (MOB-12): monto y destino, correo enmascarado, tiempo restante,
 * intentos que quedan y aviso cuando el correo no se pudo enviar. La confirmación sigue la misma
 * política de reintentos que la creación; sus acciones van en el pie (`otpControls`).
 */
export function OtpView({ state, code, onCodeChange }: OtpViewProps) {
  const { transfer } = state;
  const { otp } = transfer;
  const remaining = useSecondsUntil(otp?.expiresAt);
  const { busy } = otpControls(state);
  const pending = state.status === 'pendingOtp' ? state : undefined;

  return (
    <>
      <AmountBlock
        amount={transfer.amount}
        caption={`Para ${transfer.destination.displayName} · CLABE ${maskClabe(transfer.destination.clabeLast4)}`}
      />
      <View style={styles.list}>
        <Text style={styles.body}>
          {`Te enviamos un código de 6 dígitos a ${otp?.maskedDestination ?? 'tu correo'}.`}
        </Text>
        {otp?.deliveryStatus === 'FAILED' ? (
          <InlineAlert
            tone="warning"
            message="No pudimos enviarte el código. Reenvíalo para recibir uno nuevo."
          />
        ) : null}
        <View style={styles.tight}>
          <Text style={styles.meta}>
            {remaining > 0
              ? `El código vence en ${minutesAndSeconds(remaining)}.`
              : 'El tiempo para usar este código terminó.'}
          </Text>
          <Text style={styles.meta}>{attemptsText(otp?.attemptsRemaining ?? 0)}</Text>
        </View>

        {pending?.otpError ? (
          <InlineAlert tone="danger" message={errorMessage(pending.otpError)} />
        ) : null}
        {pending?.resendError ? (
          <InlineAlert
            tone={resendExhausted(state) ? 'warning' : 'danger'}
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
          <InlineAlert
            tone="warning"
            title={UNCERTAIN_TITLE}
            message="Puede que ya se haya confirmado. Reintenta para conocer el resultado."
          />
        ) : (
          <OtpField value={code} onChangeText={onCodeChange} disabled={busy} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[4] },
  body: { ...theme.typography.body, color: theme.colors.text.primary },
  meta: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  tight: { gap: theme.spacing[1] },
});
