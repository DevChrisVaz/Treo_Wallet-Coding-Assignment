import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/app-services';
import { Screen } from '@/components/screen';
import {
  AccountCard,
  Button,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  Skeleton,
  Wordmark,
} from '@/components/ui';
import { UnlockOffer } from '@/features/unlock/unlock-offer';
import { UnlockSwitch } from '@/features/unlock/unlock-switch';
import { errorMessage } from '@/lib/errors';
import { useRefreshByUser } from '@/lib/use-refresh-by-user';
import { logout } from '@/session/logout';
import { theme } from '@/theme';

import { useAccountsOverview } from './queries';

/**
 * Saldo de las cuentas (MOB-05): cuentas con nombre, CLABE enmascarada y saldo, lo que queda del
 * límite diario, y estados de carga, vacío y error. Si una consulta falla, no se muestran los
 * saldos anteriores como si fueran actuales.
 */
export function HomeScreen() {
  const router = useRouter();
  const { session, api } = useServices();
  const overview = useAccountsOverview();
  const refresh = useRefreshByUser(overview.refetch);

  return (
    <Screen
      refresh={refresh}
      footer={
        <>
          <Button label="Transferir" onPress={() => router.push('/transfer')} />
          <Button label="Cerrar sesión" variant="ghost" onPress={() => void logout(session, api)} />
        </>
      }
    >
      <View style={styles.header}>
        <Wordmark variant="compact" />
        <Text style={styles.title} accessibilityRole="header">
          Tus cuentas
        </Text>
      </View>

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
              onPress={() =>
                router.push({
                  pathname: '/accounts/[accountId]',
                  params: { accountId: account.id },
                })
              }
            />
          ))}
          <Text style={styles.hint}>Toca una cuenta para ver sus últimos movimientos.</Text>
        </View>
      )}

      <UnlockSwitch />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[2] },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  list: { gap: theme.spacing[4] },
  hint: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
});
