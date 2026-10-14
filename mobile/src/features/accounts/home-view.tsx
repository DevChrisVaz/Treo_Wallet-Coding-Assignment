import type { AccountsOverview, Movement } from '@devchrisvaz/wallet-contract';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  AccountCard,
  AppHeader,
  BalanceHero,
  Button,
  DailyLimitMeter,
  EmptyState,
  InlineAlert,
  ListSection,
  MovementList,
  QuickActions,
  Skeleton,
} from '@/components/ui';
import { sumAmounts } from '@/lib/display';
import type { Loadable } from '@/lib/loadable';
import { theme } from '@/theme';

export interface HomeViewProps {
  user: { name: string; email: string };
  onLogout: () => void;
  refresh?: { refreshing: boolean; onRefresh: () => void } | undefined;
  overview: Loadable<AccountsOverview>;
  selectedId: string | undefined;
  latest: Loadable<Movement[]>;
  /** Referencia de "Hoy" y "Ayer" (lienzos); por omisión, la hora actual. */
  now?: Date | undefined;
  onSelect: (accountId: string) => void;
  onRetryOverview: () => void;
  onRetryLatest: () => void;
  onTransfer: () => void;
  onSeeAll: () => void;
  /** Oferta del desbloqueo biométrico (bonus, MOB-24): la pone el contenedor. */
  offer?: ReactNode;
  /** Lo que va en el menú de la cuenta junto a "Cerrar sesión" (el interruptor del desbloqueo, R46). */
  menuExtra?: ReactNode;
}

/** Inicio (MOB-19): saludo, hero, cuentas seleccionables, límite diario y últimos 5 movimientos. */
export function HomeView(props: HomeViewProps) {
  const { user, onLogout, refresh, overview, onRetryOverview, offer, menuExtra } = props;
  return (
    <Screen
      tabBar
      refresh={refresh}
      header={<AppHeader user={user} onLogout={onLogout} menuExtra={menuExtra} />}
    >
      {overview.status === 'pending' || overview.status === 'error' ? offer : null}
      {overview.status === 'pending' ? (
        <>
          <Skeleton variant="card" />
          <View style={styles.stack}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </View>
          <ListSection>
            <View style={styles.stack}>
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </View>
          </ListSection>
        </>
      ) : overview.status === 'error' ? (
        <View style={styles.list}>
          <InlineAlert
            tone="danger"
            title="No pudimos cargar tus cuentas"
            message={overview.message}
          />
          <Button label="Reintentar" variant="secondary" onPress={onRetryOverview} />
        </View>
      ) : overview.data.accounts.length === 0 ? (
        <>
          <BalanceHero total="0.00" available={overview.data.dailyLimit.remaining} />
          {offer}
          <EmptyState
            icon="account"
            title="Aún no tienes cuentas"
            description="Cuando tu cuenta esté lista, aquí verás su saldo."
            action={{ label: 'Volver a cargar', onPress: onRetryOverview }}
          />
        </>
      ) : (
        <HomeContent {...props} data={overview.data} />
      )}
    </Screen>
  );
}

function HomeContent({
  data,
  selectedId,
  latest,
  now,
  onSelect,
  onRetryLatest,
  onTransfer,
  onSeeAll,
  offer,
}: HomeViewProps & { data: AccountsOverview }) {
  return (
    <>
      <BalanceHero
        total={sumAmounts(data.accounts.map((account) => account.balance))}
        available={data.dailyLimit.remaining}
        actions={
          <QuickActions
            actions={[
              { key: 'transfer', label: 'Transferir', icon: 'transfer', onPress: onTransfer },
              { key: 'movements', label: 'Movimientos', icon: 'movements', onPress: onSeeAll },
            ]}
          />
        }
      />
      {offer}
      <View style={styles.stack}>
        {data.accounts.map((account) => (
          <AccountCard
            key={account.id}
            name={account.name}
            clabe={account.clabe}
            balance={account.balance}
            selected={account.id === selectedId}
            onPress={() => onSelect(account.id)}
          />
        ))}
      </View>
      <ListSection>
        <DailyLimitMeter dailyLimit={data.dailyLimit} />
      </ListSection>
      <ListSection
        title="Últimos movimientos"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver todos los movimientos"
            onPress={onSeeAll}
            style={styles.link}
          >
            <Text style={styles.linkText}>Ver todos</Text>
          </Pressable>
        }
      >
        {latest.status === 'pending' ? (
          <View style={styles.stack}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </View>
        ) : latest.status === 'error' ? (
          <View style={styles.list}>
            <InlineAlert
              tone="danger"
              title="No pudimos cargar los movimientos"
              message={latest.message}
            />
            <Button label="Reintentar" variant="secondary" onPress={onRetryLatest} />
          </View>
        ) : latest.data.length === 0 ? (
          <Text style={styles.empty}>Aún no hay movimientos en esta cuenta.</Text>
        ) : (
          <MovementList movements={latest.data} now={now} />
        )}
      </ListSection>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing[3] },
  list: { gap: theme.spacing[4] },
  link: { minHeight: theme.touchTarget, justifyContent: 'center' },
  linkText: { ...theme.typography.label, color: theme.colors.action.primary },
  empty: {
    ...theme.typography.bodySm,
    color: theme.colors.text.secondary,
    paddingVertical: theme.spacing[3],
  },
});
