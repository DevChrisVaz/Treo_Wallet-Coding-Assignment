'use client';

import { matchesBeneficiary, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';

/**
 * Búsqueda de beneficiarios del lado del cliente (WEB-36): la lista no está
 * paginada. Filtra con `matchesBeneficiary` del contrato (sin distinguir mayúsculas ni acentos en
 * nombre y alias; los dígitos buscan dentro de la CLABE).
 */
export function useBeneficiarySearch<T extends Pick<Beneficiary, 'name' | 'alias' | 'clabe'>>(
  items: readonly T[],
) {
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () => items.filter((item) => matchesBeneficiary(item, query)),
    [items, query],
  );
  return { query, setQuery, visible, clear: () => setQuery('') };
}

export interface BeneficiarySearchFieldProps {
  query: string;
  onChange: (query: string) => void;
}

/** Campo sobre la lista: se muestra solo si hay beneficiarios (lo decide quien lo usa). */
export function BeneficiarySearchField({ query, onChange }: BeneficiarySearchFieldProps) {
  return (
    <SearchField
      label="Buscar beneficiarios"
      placeholder="Buscar por nombre, alias o CLABE"
      value={query}
      onChange={(event) => onChange(event.target.value)}
      onClear={() => onChange('')}
    />
  );
}

/**
 * Sin coincidencias: "Sin resultados" con "Limpiar búsqueda". Suelto en la página es el `EmptyState`
 * del kit; `flat` (paso de destinatario, dentro de una tarjeta) va sin tarjeta propia para no anidar
 * sombras.
 */
export function BeneficiaryNoResults({
  query,
  onClear,
  flat = false,
}: {
  query: string;
  onClear: () => void;
  flat?: boolean;
}) {
  const description = `No hay beneficiarios que coincidan con «${query.trim()}».`;
  const action = (
    <Button variant="secondary" onClick={onClear}>
      Limpiar búsqueda
    </Button>
  );
  if (!flat) {
    return (
      <EmptyState
        icon="beneficiaries"
        title="Sin resultados"
        description={description}
        action={action}
      />
    );
  }
  return (
    <div className="grid justify-items-center gap-3 px-6 py-8 text-center">
      <Avatar size="lg" icon="beneficiaries" />
      <h3 className="text-h3 text-fg">Sin resultados</h3>
      <p className="text-body text-fg-secondary">{description}</p>
      {action}
    </div>
  );
}
