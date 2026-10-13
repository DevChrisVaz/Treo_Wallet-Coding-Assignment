'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states/states';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBeneficiaries } from '@/lib/client/queries';
import { maskClabe } from '@/lib/money';

/** Lista de beneficiarios (WEB-15) con estados de carga, error y vacío (WEB-20). */
export function BeneficiariesScreen() {
  const beneficiaries = useBeneficiaries();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h1">Beneficiarios</h1>
        <Link href="/beneficiaries/new" className={buttonClasses('primary')}>
          Agregar beneficiario
        </Link>
      </div>

      {beneficiaries.isPending ? (
        <LoadingState label="Cargando tus beneficiarios" />
      ) : beneficiaries.isError ? (
        <ErrorState
          title="No pudimos cargar tus beneficiarios"
          error={beneficiaries.error}
          onRetry={() => void beneficiaries.refetch()}
        />
      ) : beneficiaries.data.items.length === 0 ? (
        <EmptyState
          title="Aún no tienes beneficiarios"
          description="Agrega con su CLABE a las personas a las que les envías dinero."
          action={
            <Link href="/beneficiaries/new" className={buttonClasses('secondary')}>
              Agregar beneficiario
            </Link>
          }
        />
      ) : (
        <ul aria-label="Beneficiarios" className="grid gap-3">
          {beneficiaries.data.items.map((beneficiary) => (
            <li
              key={beneficiary.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle p-4"
            >
              <div className="grid gap-0.5">
                <p className="text-label text-fg">{beneficiary.alias}</p>
                <p className="text-body-sm text-fg-secondary">{beneficiary.name}</p>
                <p className="text-caption text-fg-muted tabular-nums">
                  CLABE {maskClabe(beneficiary.clabe)}
                </p>
              </div>
              <Link
                href={`/transfers/new?beneficiary=${beneficiary.id}`}
                aria-label={`Transferir a ${beneficiary.alias}`}
                className={buttonClasses('secondary')}
              >
                Transferir
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
