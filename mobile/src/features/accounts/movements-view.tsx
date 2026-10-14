import type { AccountsOverview, Movement } from '@devchrisvaz/wallet-contract';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  AppHeader,
  Button,
  EmptyState,
  InlineAlert,
  ListSection,
  MovementList,
  Skeleton,
} from '@/components/ui';
import type { Loadable } from '@/lib/loadable';
import { theme } from '@/theme';

export interface MovementsViewProps {
  user: { name: string; email: string };
  onLogout: () => void;
  /** Lo que va en el menú de la cuenta junto a "Cerrar sesión" (el interruptor del desbloqueo, R46). */
  menuExtra?: ReactNode;
  refresh?: { refreshing: boolean; onRefresh: () => void } | undefined;
  overview: Loadable<AccountsOverview>;
  selectedId: string | undefined;
  movements: Loadable<Movement[]>;
  /** Referencia de "Hoy" y "Ayer" (lienzos); por omisión, la hora actual. */
  now?: Date | undefined;
  onSelect: (accountId: string) => void;
  onRetryAccounts: () => void;
  onRetryMovements: () => void;
}

/** Movimientos (MOB-06, MOB-20): selector de cuenta y los últimos 20 agrupados por día. */
export function MovementsView({
  user,
  onLogout,
  menuExtra,
  refresh,
  overview,
  selectedId,
  movements,
  now,
  onSelect,
  onRetryAccounts,
  onRetryMovements,
}: MovementsViewProps) {
  return (
    <Screen
      tabBar
      refresh={refresh}
      header={
        <AppHeader user={user} title="Movimientos" onLogout={onLogout} menuExtra={menuExtra} />
      }
    >
      {overview.status === 'pending' ? (
        <View style={styles.loading}>
          <Skeleton variant="line" />
          <Skeleton variant="line" />
          <Skeleton variant="line" />
        </View>
      ) : overview.status === 'error' ? (
        <View style={styles.loading}>
          <InlineAlert
            tone="danger"
            title="No pudimos cargar tus cuentas"
            message={overview.message}
          />
          <Button label="Reintentar" variant="secondary" onPress={onRetryAccounts} />
        </View>
      ) : (
        <>
          <View style={styles.segmented}>
            {overview.data.accounts.map((account) => (
              <View key={account.id} style={styles.segment}>
                <Button
                  label={account.name}
                  variant={account.id === selectedId ? 'primary' : 'secondary'}
                  selected={account.id === selectedId}
                  onPress={() => onSelect(account.id)}
                />
              </View>
            ))}
          </View>
          {movements.status === 'pending' ? (
            <View style={styles.loading}>
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} variant="line" />
              ))}
            </View>
          ) : movements.status === 'error' ? (
            <View style={styles.loading}>
              <InlineAlert
                tone="danger"
                title="No pudimos cargar los movimientos"
                message={movements.message}
              />
              <Button label="Reintentar" variant="secondary" onPress={onRetryMovements} />
            </View>
          ) : movements.data.length === 0 ? (
            <EmptyState
              icon="movements"
              title="Aún no hay movimientos"
              description="Aquí verás los depósitos y las transferencias de esta cuenta."
            />
          ) : (
            <ListSection>
              <MovementList movements={movements.data} now={now} />
            </ListSection>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { gap: theme.spacing[4] },
  segmented: { flexDirection: 'row', gap: theme.spacing[2] },
  segment: { flex: 1 },
});
