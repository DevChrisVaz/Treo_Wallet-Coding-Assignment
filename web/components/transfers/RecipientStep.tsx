import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BeneficiaryNoResults,
  BeneficiarySearchField,
  useBeneficiarySearch,
} from '@/components/beneficiaries/BeneficiarySearch';
import { Avatar, initials } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ListSection } from '@/components/ui/ListSection';
import type { TransferRecipient } from '@/lib/client/transfer-flow';
import { maskClabe } from '@/lib/money';
import { SCHEDULED_TRANSFERS_PATH } from '@/lib/navigation';

export interface RecipientStepProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  onChoose: (recipient: TransferRecipient) => void;
}

/** Fila de destino: botón a todo lo ancho con avatar, nombre, detalle y flecha. */
function RecipientOption({
  avatar,
  label,
  description,
  onClick,
}: {
  avatar: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
      >
        {avatar}
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-label text-fg">{label}</span>
          <span className="truncate text-caption text-fg-secondary">{description}</span>
        </span>
        <Icon name="forward" className="text-fg-muted" />
      </button>
    </li>
  );
}

/**
 * Paso 1 del flujo (WEB-30): a quién se envía. Ofrece todas las cuentas propias (R38: el origen se
 * elige en el paso siguiente, que ya no ofrece la cuenta elegida aquí) y los beneficiarios, que se pueden
 * buscar (WEB-36; las cuentas propias no se filtran). En
 * teléfono también lleva a las transferencias programadas (WEB-34), que no son pestaña.
 */
export function RecipientStep({ accounts, beneficiaries, onChoose }: RecipientStepProps) {
  const search = useBeneficiarySearch(beneficiaries);
  return (
    <>
      <ListSection title="Tus cuentas">
        <ul className="divide-y divide-border">
          {accounts.map((account) => (
            <RecipientOption
              key={account.id}
              avatar={<Avatar icon="ownTransfer" />}
              label={account.name}
              description={`CLABE ${maskClabe(account.clabe)} · ${formatMXN(account.balance)}`}
              onClick={() => onChoose({ destinationType: 'OWN_ACCOUNT', toAccountId: account.id })}
            />
          ))}
        </ul>
      </ListSection>
      <ListSection title="Beneficiarios">
        {beneficiaries.length > 0 ? (
          <div className="grid gap-2">
            <BeneficiarySearchField query={search.query} onChange={search.setQuery} />
            {search.visible.length > 0 ? (
              <ul className="divide-y divide-border">
                {search.visible.map((beneficiary) => (
                  <RecipientOption
                    key={beneficiary.id}
                    avatar={<Avatar initials={initials(beneficiary.name)} />}
                    label={beneficiary.alias}
                    description={`${beneficiary.name} · CLABE ${maskClabe(beneficiary.clabe)}`}
                    onClick={() =>
                      onChoose({ destinationType: 'BENEFICIARY', beneficiaryId: beneficiary.id })
                    }
                  />
                ))}
              </ul>
            ) : (
              <BeneficiaryNoResults query={search.query} onClear={search.clear} flat />
            )}
          </div>
        ) : (
          <p className="py-3 text-body-sm text-fg-secondary">
            Aún no tienes beneficiarios.{' '}
            <Link href="/beneficiaries/new" className="text-action underline underline-offset-2">
              Agregar beneficiario
            </Link>
          </p>
        )}
      </ListSection>
      {/* En el dashboard "Programadas" está en la navegación lateral (WEB-26). */}
      <Link href={SCHEDULED_TRANSFERS_PATH} className={buttonClasses('ghost', 'dashboard:hidden')}>
        Transferencias programadas
      </Link>
    </>
  );
}
