'use client';

import { ProblemError, type MovementPage, type MovementType } from '@devchrisvaz/wallet-contract';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { StatementDownload } from '@/components/accounts/StatementDownload';
import { ErrorState, LoadingState } from '@/components/states/states';
import { Button, buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MovementRow } from '@/components/ui/MovementRow';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { bffGet } from '@/lib/client/bff';
import { useAccountsOverview } from '@/lib/client/queries';
import { queryKeys, type MovementFilters } from '@/lib/client/query-keys';
import { MOVEMENT_TYPE } from '@/lib/conventions';

const NO_FILTERS: MovementFilters = { from: '', to: '', types: [] };
const TYPE_ORDER = Object.keys(MOVEMENT_TYPE) as MovementType[];

function hasFilters(filters: MovementFilters): boolean {
  return filters.from !== '' || filters.to !== '' || filters.types.length > 0;
}

/** Error de "Hasta" cuando el rango está invertido; la API respondería 422 (WEB-14). */
const INVERTED_RANGE = 'Elige una fecha igual o posterior a la de Desde.';

/** Las fechas son `AAAA-MM-DD`, así que se comparan bien como texto. */
function isInvertedRange(filters: MovementFilters): boolean {
  return filters.from !== '' && filters.to !== '' && filters.from > filters.to;
}

function isInvalidCursor(error: unknown): boolean {
  return error instanceof ProblemError && error.code === 'INVALID_CURSOR';
}

/**
 * Historial de movimientos (WEB-14): cuenta, rango de fechas y tipos, con paginación por cursor.
 * Los filtros forman parte de la clave de la consulta: al cambiar uno se descarta el cursor y se
 * empieza desde la primera página. Encima de los filtros, la descarga del estado de cuenta (WEB-32).
 */
export function MovementsScreen({ accountId }: { accountId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const overview = useAccountsOverview();
  const [filters, setFilters] = useState<MovementFilters>(NO_FILTERS);
  const queryKey = useMemo(() => queryKeys.movements(accountId, filters), [accountId, filters]);
  const invertedRange = isInvertedRange(filters);

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

  function toggleType(type: MovementType) {
    setFilters((current) => {
      const selected = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];
      return { ...current, types: TYPE_ORDER.filter((item) => selected.includes(item)) };
    });
  }

  const items = movements.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid gap-6">
      {/* Componente aparte (D11 de account-statements): el rediseño lo reubica sin cambiarlo. */}
      <StatementDownload key={accountId} accountId={accountId} />

      <div className="grid gap-4 sm:grid-cols-3">
        {overview.data ? (
          <Select
            label="Cuenta"
            value={accountId}
            onChange={(event) => router.push(`/accounts/${event.target.value}/movements`)}
          >
            {overview.data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        ) : null}
        <TextField
          label="Desde"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
        />
        <TextField
          label="Hasta"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          error={invertedRange ? INVERTED_RANGE : undefined}
          onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-label text-fg">Tipo</legend>
        <div className="flex flex-wrap gap-x-4">
          {TYPE_ORDER.map((type) => (
            <label key={type} className="inline-flex min-h-11 items-center gap-2 text-body-sm">
              <input
                type="checkbox"
                className="size-4 accent-action"
                checked={filters.types.includes(type)}
                onChange={() => toggleType(type)}
              />
              {MOVEMENT_TYPE[type].label}
            </label>
          ))}
        </div>
      </fieldset>

      {invertedRange ? null : movements.isPending || invalidCursor ? (
        <LoadingState label="Cargando movimientos" />
      ) : movements.isError && !movements.isFetchNextPageError ? (
        <ErrorState
          title="No pudimos cargar los movimientos"
          error={movements.error}
          onRetry={() => void movements.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
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
        <section className="grid gap-4">
          <ul aria-label="Movimientos">
            {items.map((item) => (
              <MovementRow key={item.id} movement={item} />
            ))}
          </ul>
          {movements.isFetchNextPageError ? (
            <ErrorState
              title="No pudimos cargar más movimientos"
              error={movements.error}
              onRetry={() => void movements.fetchNextPage()}
            />
          ) : null}
          {movements.hasNextPage && !movements.isFetchNextPageError ? (
            <div>
              <Button
                variant="secondary"
                loading={movements.isFetchingNextPage}
                loadingLabel="Cargando…"
                onClick={() => void movements.fetchNextPage()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
