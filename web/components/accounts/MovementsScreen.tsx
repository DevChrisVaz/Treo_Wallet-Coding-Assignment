'use client';

import { ProblemError, type MovementPage } from '@devchrisvaz/wallet-contract';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MovementFiltersForm, isInvertedRange } from '@/components/accounts/MovementFilters';
import { StatementDownload } from '@/components/accounts/StatementDownload';
import { ErrorState, LoadingState } from '@/components/states/states';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSection } from '@/components/ui/ListSection';
import { MovementList } from '@/components/ui/MovementList';
import { useAccountSelection } from '@/lib/client/account-selection';
import { bffGet } from '@/lib/client/bff';
import { useAccountsOverview } from '@/lib/client/queries';
import { queryKeys, type MovementFilters } from '@/lib/client/query-keys';

const NO_FILTERS: MovementFilters = { from: '', to: '', types: [] };

function hasFilters(filters: MovementFilters): boolean {
  return filters.from !== '' || filters.to !== '' || filters.types.length > 0;
}

function isInvalidCursor(error: unknown): boolean {
  return error instanceof ProblemError && error.code === 'INVALID_CURSOR';
}

/**
 * Historial de movimientos (WEB-14, WEB-29): selector de cuenta en dos mitades y "Filtros", que
 * abre la hoja con el rango de fechas y los tipos; la lista va agrupada por día, con paginación por
 * cursor. Los filtros aplicados forman parte de la clave de la consulta: al cambiar uno se descarta
 * el cursor y se empieza desde la primera página. La cuenta abierta queda elegida para Inicio y la
 * pestaña Movimientos (WEB-28). Después del historial, la tarjeta del estado de cuenta (WEB-32,
 * R53).
 */
export function MovementsScreen({ accountId }: { accountId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const overview = useAccountsOverview();
  const { select } = useAccountSelection();
  const [filters, setFilters] = useState<MovementFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryKey = useMemo(() => queryKeys.movements(accountId, filters), [accountId, filters]);
  const invertedRange = isInvertedRange(filters);

  useEffect(() => select(accountId), [accountId, select]);

  const movements = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      bffGet<MovementPage>(`accounts/${accountId}/movements`, {
        from: filters.from || undefined,
        to: filters.to || undefined,
        type: filters.types,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !invertedRange,
  });

  // Un cursor que ya no corresponde a los filtros: se recarga la primera página (WEB-14).
  const invalidCursor = isInvalidCursor(movements.error);
  useEffect(() => {
    if (invalidCursor) void queryClient.resetQueries({ queryKey, exact: true });
  }, [invalidCursor, queryClient, queryKey]);

  const items = movements.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {/* Cuenta y "Filtros" (historia `MovementsToolbar`): en teléfono, los filtros en su propia
          fila; en el dashboard, a la derecha del selector. */}
      <div className="grid gap-2 dashboard:flex dashboard:items-center dashboard:justify-between">
        {overview.data ? (
          <div role="group" aria-label="Cuenta" className="grid grid-cols-2 gap-2 dashboard:w-80">
            {overview.data.accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                aria-pressed={account.id === accountId}
                className={buttonClasses(account.id === accountId ? 'primary' : 'secondary')}
                onClick={() => router.push(`/accounts/${account.id}/movements`)}
              >
                {account.name}
              </button>
            ))}
          </div>
        ) : null}
        <Button
          variant="ghost"
          icon="filter"
          aria-haspopup="dialog"
          // En el dashboard queda a la derecha también mientras cargan las cuentas.
          className="justify-self-end dashboard:ml-auto"
          onClick={() => setFiltersOpen(true)}
        >
          Filtros
        </Button>
      </div>

      {invertedRange ? null : movements.isPending || invalidCursor ? (
        <ListSection>
          <LoadingState label="Cargando movimientos" count={4} />
        </ListSection>
      ) : movements.isError && !movements.isFetchNextPageError ? (
        <ErrorState
          title="No pudimos cargar los movimientos"
          error={movements.error}
          onRetry={() => void movements.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="movements"
          title="No hay movimientos en este periodo"
          description="Prueba con otras fechas u otros tipos de movimiento."
          action={
            hasFilters(filters) ? (
              <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                Limpiar filtros
              </Button>
            ) : (
              <Link
                href={`/transfers/new?from=${accountId}`}
                className={buttonClasses('secondary')}
              >
                Nueva transferencia
              </Link>
            )
          }
        />
      ) : (
        <section aria-label="Movimientos" className="grid gap-5">
          <ListSection>
            {/* Directo bajo el h1 de AppShell: los días van a nivel 2 (M-4). */}
            <MovementList movements={items} headingLevel={2} />
          </ListSection>
          {movements.isFetchNextPageError ? (
            <ErrorState
              title="No pudimos cargar más movimientos"
              error={movements.error}
              onRetry={() => void movements.fetchNextPage()}
            />
          ) : null}
          {movements.hasNextPage && !movements.isFetchNextPageError ? (
            <Button
              variant="secondary"
              className="dashboard:justify-self-center"
              loading={movements.isFetchingNextPage}
              loadingLabel="Cargando…"
              onClick={() => void movements.fetchNextPage()}
            >
              Cargar más
            </Button>
          ) : null}
        </section>
      )}

      {/* Función propia de la web, fuera de las historias aprobadas (R53): tarjeta aparte después
          del historial, para no mover el selector, "Filtros" ni la lista de la historia
          `Movements`. La clave reinicia el mes elegido al cambiar de cuenta. */}
      <StatementDownload key={accountId} accountId={accountId} />

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar movimientos"
      >
        <MovementFiltersForm
          initial={filters}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
          onClear={() => {
            setFilters(NO_FILTERS);
            setFiltersOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}
