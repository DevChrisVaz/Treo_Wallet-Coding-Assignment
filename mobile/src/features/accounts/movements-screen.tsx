import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, EmptyState, InlineAlert, MovementRow, Skeleton } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useRefreshByUser } from '@/lib/use-refresh-by-user';
import { theme } from '@/theme';

import { useAccountsOverview, useRecentMovements } from './queries';

/**
 * Últimos 20 movimientos de la cuenta elegida (MOB-06), del más reciente al más antiguo, con tipo,
 * concepto, contraparte, monto con signo y saldo resultante. Sin filtros ni paginación.
 */
export function MovementsScreen() {
  const router = useRouter();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const movements = useRecentMovements(accountId);
  const account = useAccountsOverview().data?.accounts.find((item) => item.id === accountId);
  const refresh = useRefreshByUser(movements.refetch);

  return (
    <Screen
      refresh={refresh}
      footer={<Button label="Volver" variant="ghost" onPress={() => router.back()} />}
    >
      <View style={styles.header}>
        <Text style={styles.overline}>Últimos movimientos</Text>
        <Text style={styles.title} accessibilityRole="header">
          {account?.name ?? 'Tu cuenta'}
        </Text>
      </View>

      {movements.isPending ? (
        <View style={styles.loading}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="line" />
          ))}
        </View>
      ) : movements.isError ? (
        <View style={styles.loading}>
          <InlineAlert tone="danger" message={errorMessage(movements.error)} />
          <Button label="Reintentar" variant="secondary" onPress={() => void movements.refetch()} />
        </View>
      ) : movements.data.length === 0 ? (
        <EmptyState
          title="Aún no hay movimientos"
          description="Aquí verás los depósitos y las transferencias de esta cuenta."
        />
      ) : (
        <View>
          {movements.data.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[1] },
  overline: { ...theme.typography.label, color: theme.colors.text.secondary },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  loading: { gap: theme.spacing[4] },
});
