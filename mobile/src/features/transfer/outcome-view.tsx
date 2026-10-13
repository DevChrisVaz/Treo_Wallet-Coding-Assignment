import { formatMXN } from '@devchrisvaz/wallet-contract';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, InlineAlert, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

import type { AttemptState, TransferAttempt } from './transfer-attempt';

type OutcomeState = Extract<AttemptState, { status: 'completed' | 'failed' | 'expired' }>;

/** Resultado del intento con el estado real que devolvió la API (MOB-13). */
export function OutcomeView({ attempt, state }: { attempt: TransferAttempt; state: OutcomeState }) {
  const router = useRouter();
  const home = (
    <Button label="Ir a mis cuentas" variant="secondary" onPress={() => router.replace('/')} />
  );

  if (state.status === 'completed') {
    return (
      <View style={styles.container}>
        <StatusBadge status={state.transfer.status} />
        <Text style={styles.amount}>{formatMXN(state.transfer.amount)}</Text>
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
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
});
