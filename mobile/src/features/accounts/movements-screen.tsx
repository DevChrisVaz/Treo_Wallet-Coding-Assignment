import { loadable } from '@/lib/loadable';
import { useRefreshByUser } from '@/lib/use-refresh-by-user';

import { useAccountHeader } from './account-header';
import { MovementsView } from './movements-view';
import { useAccountsOverview, useRecentMovements } from './queries';
import { selectedAccount, useAccountSelection } from './selection';

/**
 * Últimos 20 movimientos de la cuenta elegida (MOB-06), del más reciente al más antiguo, con tipo,
 * concepto, contraparte, monto con signo y saldo resultante. Sin filtros ni paginación. Un selector
 * con una opción por cuenta cambia de cuenta, y la lista se agrupa por día de Ciudad de México
 * (MOB-20).
 */
export function MovementsScreen() {
  const header = useAccountHeader();
  const { accountId, select } = useAccountSelection();
  const overview = useAccountsOverview();
  const selected = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined;
  const movements = useRecentMovements(selected?.id);
  // `refetch` ignora `enabled`: sin cuenta elegida no se piden movimientos (`/accounts//movements`).
  const refresh = useRefreshByUser(() =>
    Promise.all([overview.refetch(), selected ? movements.refetch() : undefined]),
  );

  return (
    <MovementsView
      user={header.user}
      onLogout={header.onLogout}
      menuExtra={header.menuExtra}
      refresh={refresh}
      overview={loadable(overview)}
      selectedId={selected?.id}
      movements={loadable(movements)}
      onSelect={select}
      onRetryAccounts={() => void overview.refetch()}
      onRetryMovements={() => void movements.refetch()}
    />
  );
}
