import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, InlineAlert, Receipt, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

import type { AttemptState, TransferAttempt } from './transfer-attempt';

type OutcomeState = Extract<AttemptState, { status: 'completed' | 'failed' | 'expired' }>;

/** Resultado del intento con el estado real que devolvió la API (MOB-13). */
interface OutcomeViewProps {
  attempt: TransferAttempt;
  state: OutcomeState;
  fromAccountName?: string | undefined;
}

export function OutcomeView({ attempt, state, fromAccountName }: OutcomeViewProps) {
  const router = useRouter();
  const home = (
    <Button label="Ir a mis cuentas" variant="secondary" onPress={() => router.replace('/')} />
  );

  if (state.status === 'completed') {
    return (
      <View style={styles.container}>
        {state.replayed ? (
          <InlineAlert
            tone="info"
            message="Tu transferencia ya se había registrado; este es su estado actual."
          />
        ) : null}
        <Receipt transfer={state.transfer} fromAccountName={fromAccountName} />
        {home}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBadge status={state.status === 'expired' ? 'EXPIRED' : 'FAILED'} />
      <InlineAlert tone="danger" message={errorMessage(state.error)} />
      <Button label="Intentar de nuevo" onPress={() => attempt.restart()} />
      {home}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[4] },
});
