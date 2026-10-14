'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states/states';
import { AccountCard } from '@/components/ui/AccountCard';
import { BalanceHero } from '@/components/ui/BalanceHero';
import { Button } from '@/components/ui/Button';
import { DailyLimitMeter } from '@/components/ui/DailyLimitMeter';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSection } from '@/components/ui/ListSection';
import { MovementList } from '@/components/ui/MovementList';
import { QuickActions } from '@/components/ui/QuickActions';
import { Skeleton } from '@/components/ui/Skeleton';
import { selectedAccount, useAccountSelection } from '@/lib/client/account-selection';
import { useAccountsOverview, useLatestMovements } from '@/lib/client/queries';
import { sumAmounts } from '@/lib/money';

/**
 * Inicio (WEB-28, amplía WEB-13): hero con el saldo total (suma en centavos, sin floats) y lo que
 * queda del límite diario tal como lo devuelve la API, tarjetas que seleccionan la cuenta, el medidor
 * del límite y los últimos 5 movimientos de la cuenta elegida con "Ver todos". Saldos con
 * `formatMXN`; el navegador no recalcula el límite ni hace otra aritmética con montos.
 */
export function AccountsOverviewScreen() {
  const overview = useAccountsOverview();
  const { accountId, select } = useAccountSelection();
  const accounts = overview.data?.accounts ?? [];
  const selected = selectedAccount(accounts, accountId);

  if (overview.isPending) {
    return (
      <>
        <Skeleton variant="card" />
        <div className="grid gap-5 dashboard:grid-cols-2">
          <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
          <ListSection>
            <LoadingState label="Cargando movimientos" count={4} />
          </ListSection>
        </div>
      </>
    );
  }
  if (overview.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={overview.error}
        onRetry={() => void overview.refetch()}
      />
    );
  }
  const { dailyLimit } = overview.data;
  if (!selected) {
    return (
      <>
        <BalanceHero total="0.00" available={dailyLimit.remaining} />
        <EmptyState
          icon="account"
          title="Aún no tienes cuentas"
          description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
          action={
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Volver a cargar
            </Button>
          }
        />
      </>
    );
  }
  const history = `/accounts/${selected.id}/movements`;
  return (
    <>
      <BalanceHero
        total={sumAmounts(accounts.map((account) => account.balance))}
        available={dailyLimit.remaining}
        actions={
          <QuickActions
            actions={[
              {
                key: 'transfer',
                label: 'Transferir',
                icon: 'transfer',
                href: `/transfers/new?from=${selected.id}`,
              },
              { key: 'movements', label: 'Movimientos', icon: 'movements', href: history },
            ]}
          />
        }
      />
      <div className="grid gap-5 dashboard:grid-cols-2">
        <div className="grid content-start gap-5">
          <section aria-label="Cuentas" className="grid gap-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selected={account.id === selected.id}
                onSelect={() => select(account.id)}
              />
            ))}
          </section>
          <ListSection>
            {/* Las mismas props que la historia `Home`: el medidor pone su propio "Límite diario"
                (texto, no encabezado) y no hay otro título de la sección (M-2). */}
            <DailyLimitMeter dailyLimit={dailyLimit} showHeader />
          </ListSection>
        </div>
        <ListSection
          title="Últimos movimientos"
          action={
            <Link
              href={history}
              className="inline-flex min-h-11 items-center text-label text-action"
            >
              Ver todos
            </Link>
          }
        >
          <LatestMovements accountId={selected.id} />
        </ListSection>
      </div>
    </>
  );
}

/** Los últimos movimientos de la cuenta elegida, con su propia carga, error y vacío (WEB-20). */
function LatestMovements({ accountId }: { accountId: string }) {
  const latest = useLatestMovements(accountId);
  if (latest.isPending) return <LoadingState label="Cargando movimientos" count={4} />;
  if (latest.isError) {
    return (
      <ErrorState
        title="No pudimos cargar los movimientos"
        error={latest.error}
        onRetry={() => void latest.refetch()}
      />
    );
  }
  if (latest.data.length === 0) {
    return (
      <p className="py-3 text-body-sm text-fg-secondary">Aún no hay movimientos en esta cuenta.</p>
    );
  }
  return <MovementList movements={latest.data} />;
}
