'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states/states';
import { Avatar, initials } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSection } from '@/components/ui/ListSection';
import { useBeneficiaries } from '@/lib/client/queries';
import { maskClabe } from '@/lib/money';

/** Lista de beneficiarios (WEB-15) con estados de carga, error y vacío (WEB-20). */
export function BeneficiariesScreen() {
  const beneficiaries = useBeneficiaries();

  if (beneficiaries.isPending) return <LoadingState label="Cargando tus beneficiarios" />;
  if (beneficiaries.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus beneficiarios"
        error={beneficiaries.error}
        onRetry={() => void beneficiaries.refetch()}
      />
    );
  }
  if (beneficiaries.data.items.length === 0) {
    return (
      <EmptyState
        icon="beneficiaries"
        title="Aún no tienes beneficiarios"
        description="Agrega con su CLABE a las personas a las que les envías dinero."
        action={
          <Link href="/beneficiaries/new" className={buttonClasses('secondary')}>
            Agregar beneficiario
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* En escritorio la acción vive en la barra superior (WEB-26). */}
      <Link href="/beneficiaries/new" className={buttonClasses('primary', 'dashboard:hidden')}>
        Agregar beneficiario
      </Link>
      <ListSection>
        <ul aria-label="Beneficiarios" className="divide-y divide-border">
          {beneficiaries.data.items.map((beneficiary) => (
            <li key={beneficiary.id} className="flex items-center gap-3 py-3">
              <Avatar initials={initials(beneficiary.name)} />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="text-label text-fg">{beneficiary.alias}</p>
                <p className="text-body-sm text-fg-secondary">{beneficiary.name}</p>
                <p className="text-caption text-fg-muted tabular-nums">
                  CLABE {maskClabe(beneficiary.clabe)}
                </p>
              </div>
              <Link
                href={`/transfers/new?beneficiary=${beneficiary.id}`}
                aria-label={`Transferir a ${beneficiary.alias}`}
                className={buttonClasses('secondary', 'shrink-0')}
              >
                Transferir
              </Link>
            </li>
          ))}
        </ul>
      </ListSection>
    </>
  );
}
