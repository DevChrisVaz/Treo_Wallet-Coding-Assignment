import { useRouter } from 'expo-router';

import { UnlockOffer } from '@/features/unlock/unlock-offer';
import { loadable } from '@/lib/loadable';
import { useRefreshByUser } from '@/lib/use-refresh-by-user';

import { useAccountHeader } from './account-header';
import { HomeView } from './home-view';
import { useAccountsOverview, useLatestMovements } from './queries';
import { selectedAccount, useAccountSelection } from './selection';

/**
 * Saldo de las cuentas (MOB-05): cuentas con nombre, CLABE enmascarada y saldo, lo que queda del
 * límite diario, y estados de carga, vacío y error. Si una consulta falla, no se muestran los
 * saldos anteriores como si fueran actuales. Inicio (MOB-19): saludo, hero con el total, la cuenta
 * elegida (la primera, si no se ha elegido otra) y sus últimos 5 movimientos; "Ver todos" abre
 * Movimientos con esa cuenta.
 */
export function HomeScreen() {
  const router = useRouter();
  const header = useAccountHeader();
  const overview = useAccountsOverview();
  const { accountId, select } = useAccountSelection();
  const selected = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined;
  const latest = useLatestMovements(selected?.id);
  // `refetch` ignora `enabled`: sin cuenta elegida no se piden movimientos (`/accounts//movements`).
  const refresh = useRefreshByUser(() =>
    Promise.all([overview.refetch(), selected ? latest.refetch() : undefined, header.retryUser()]),
  );
  return (
    <HomeView
      user={header.user}
      onLogout={header.onLogout}
      menuExtra={header.menuExtra}
      offer={<UnlockOffer />}
      refresh={refresh}
      overview={loadable(overview)}
      selectedId={selected?.id}
      latest={loadable(latest)}
      onSelect={select}
      onRetryOverview={() => {
        void overview.refetch();
        void header.retryUser();
      }}
      onRetryLatest={() => void latest.refetch()}
      onTransfer={() => router.push('/transfer')}
      onSeeAll={() => {
        if (selected) select(selected.id);
        router.navigate('/movements');
      }}
    />
  );
}
