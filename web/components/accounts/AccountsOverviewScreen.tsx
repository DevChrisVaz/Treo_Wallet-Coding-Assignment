'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states/states';
import { AccountCard } from '@/components/ui/AccountCard';
import { Button, buttonClasses } from '@/components/ui/Button';
import { DailyLimitMeter } from '@/components/ui/DailyLimitMeter';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAccountsOverview } from '@/lib/client/queries';

/**
 * Resumen de cuentas (WEB-13): saldos con `formatMXN` y el límite diario restante tal como lo
 * devuelve la API; el navegador no recalcula el límite ni hace aritmética con montos.
 */
export function AccountsOverviewScreen() {
  const overview = useAccountsOverview();

  return (
    <div className="grid gap-8">
      {overview.isPending ? (
        <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
      ) : overview.isError ? (
        <ErrorState
          title="No pudimos cargar tus cuentas"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : overview.data.accounts.length === 0 ? (
        <EmptyState
          title="Aún no tienes cuentas"
          description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
          action={
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Volver a cargar
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="daily-limit-title" className="grid gap-3">
            <h2 id="daily-limit-title" className="text-h3">
              Límite diario de transferencias
            </h2>
            <DailyLimitMeter dailyLimit={overview.data.dailyLimit} />
          </section>
          <section aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2">
            {overview.data.accounts.map((account) => (
              <AccountCard key={account.id} account={account}>
                <Link
                  href={`/accounts/${account.id}/movements`}
                  aria-label={`Ver movimientos de ${account.name}`}
                  className={buttonClasses('secondary')}
                >
                  Ver movimientos
                </Link>
                <Link
                  href={`/transfers/new?from=${account.id}`}
                  aria-label={`Transferir desde ${account.name}`}
                  className={buttonClasses('ghost')}
                >
                  Transferir
                </Link>
              </AccountCard>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
