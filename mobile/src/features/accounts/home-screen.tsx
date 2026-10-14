import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  AccountCard,
  AppHeader,
  Button,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  Skeleton,
} from '@/components/ui';
import { UnlockOffer } from '@/features/unlock/unlock-offer';
import { errorMessage } from '@/lib/errors';
import { useRefreshByUser } from '@/lib/use-refresh-by-user';
import { theme } from '@/theme';

import { useAccountHeader } from './account-header';
import { useAccountsOverview } from './queries';
import { useAccountSelection } from './selection';

/**
 * Saldo de las cuentas (MOB-05): cuentas con nombre, CLABE enmascarada y saldo, lo que queda del
 * límite diario, y estados de carga, vacío y error. Si una consulta falla, no se muestran los
 * saldos anteriores como si fueran actuales.
 */
export function HomeScreen() {
  const router = useRouter();
  const header = useAccountHeader();
  const { select } = useAccountSelection();
  const overview = useAccountsOverview();
  const refresh = useRefreshByUser(overview.refetch);

  return (
    <Screen
      tabBar
      refresh={refresh}
      header={
        <AppHeader user={header.user} onLogout={header.onLogout} menuExtra={header.menuExtra} />
      }
    >
      <UnlockOffer />

      {overview.isPending ? (
        <View style={styles.list}>
          <Skeleton variant="line" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </View>
      ) : overview.isError ? (
        <View style={styles.list}>
          <InlineAlert tone="danger" message={errorMessage(overview.error)} />
          <Button label="Reintentar" variant="secondary" onPress={() => void overview.refetch()} />
        </View>
      ) : overview.data.accounts.length === 0 ? (
        <EmptyState
          title="Aún no tienes cuentas"
          description="Cuando tu cuenta esté lista, aquí verás su saldo."
        />
      ) : (
        <View style={styles.list}>
          <DailyLimitMeter dailyLimit={overview.data.dailyLimit} />
          {overview.data.accounts.map((account) => (
            <AccountCard
              key={account.id}
              name={account.name}
              clabe={account.clabe}
              balance={account.balance}
              onPress={() => {
                select(account.id);
                router.navigate('/movements');
              }}
            />
          ))}
          <Text style={styles.hint}>Toca una cuenta para ver sus últimos movimientos.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[4] },
  hint: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
});
