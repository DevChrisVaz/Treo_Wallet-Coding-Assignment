import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text } from 'react-native';

import { Button, InlineAlert } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useCountdown } from '@/lib/use-countdown';
import { theme } from '@/theme';

import { MAX_RETRIES, type AttemptState, type TransferAttempt } from './transfer-attempt';

export const UNCERTAIN_TITLE = 'No pudimos confirmar el estado de tu transferencia';

interface AttemptActionsProps {
  attempt: TransferAttempt;
  state: AttemptState;
}

/**
 * Avisos y acciones de un intento con datos congelados (MOB-09, MOB-10, MOB-11, MOB-14). Enviar
 * queda deshabilitado desde el envío hasta un resultado definitivo o el estado incierto; el estado
 * incierto no se presenta como éxito ni como falla y solo ofrece reintentar con la misma llave.
 */
export function AttemptActions({ attempt, state }: AttemptActionsProps) {
  switch (state.status) {
    case 'reviewing':
      return (
        <>
          <Button label="Enviar" onPress={() => void attempt.submit()} />
          <Button label="Editar" variant="ghost" onPress={() => attempt.edit()} />
        </>
      );
    case 'sending':
      return <Button label="Enviar" onPress={() => undefined} loading />;
    case 'waitingRetry':
      return (
        <>
          <InlineAlert
            tone="warning"
            message={`Perdimos la conexión. Reintentaremos la misma operación (${state.retry} de ${MAX_RETRIES}).`}
          />
          <Button label="Enviar" onPress={() => undefined} loading />
        </>
      );
    case 'uncertain':
      return (
        <>
          <InlineAlert
            tone="warning"
            title={UNCERTAIN_TITLE}
            message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces."
          />
          <Button label="Reintentar" onPress={() => void attempt.retry()} />
        </>
      );
    case 'rateLimited':
      return <RateLimited attempt={attempt} seconds={state.retryAfterSeconds} />;
    case 'rejected':
    case 'error':
      return (
        <>
          <InlineAlert tone="danger" message={errorMessage(state.error)} />
          <Button label="Corregir" variant="secondary" onPress={() => attempt.edit()} />
        </>
      );
    default:
      return null;
  }
}

function RateLimited({
  attempt,
  seconds,
}: {
  attempt: TransferAttempt;
  seconds: number | undefined;
}) {
  const countdown = useCountdown(seconds);

  return (
    <>
      <InlineAlert tone="warning" message={problemMessage('RATE_LIMITED')} />
      {countdown.remaining > 0 ? (
        <Text style={styles.countdown} accessibilityLiveRegion="polite">
          {`Podrás reintentar en ${countdown.remaining} s, con la misma operación.`}
        </Text>
      ) : null}
      <Button
        label="Reintentar"
        onPress={() => void attempt.retry()}
        disabled={countdown.remaining > 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
});
