import { formatMXN, type Account, type Transfer } from '@devchrisvaz/wallet-contract';
import { useId, type ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import { maskClabe } from '@/lib/money';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

export interface ReceiptProps {
  transfer: Transfer;
  /** Cuenta de origen, si se conoce, para mostrar su nombre y CLABE enmascarada. */
  fromAccount?: Pick<Account, 'name' | 'clabe'> | undefined;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className="text-body text-fg sm:col-span-2">{children}</dd>
    </div>
  );
}

/**
 * Comprobante (D7 de design-system, WEB-16): estado, monto, origen, destino, concepto, referencia,
 * fecha y folio (`transferId`).
 */
export function Receipt({ transfer, fromAccount }: ReceiptProps) {
  const titleId = useId();
  const origin = fromAccount
    ? `${fromAccount.name} ${maskClabe(fromAccount.clabe)}`
    : transfer.fromAccountId;
  const destination = `${transfer.destination.displayName} •••• ${transfer.destination.clabeLast4}`;

  return (
    <section aria-labelledby={titleId} className="grid gap-4 rounded-lg bg-surface p-6 shadow-card">
      <Avatar
        size="lg"
        tone={transfer.status === 'COMPLETED' ? 'success' : 'neutral'}
        icon={transfer.status === 'COMPLETED' ? 'success' : 'info'}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-h3 text-fg">
          Comprobante
        </h2>
        <StatusBadge status={transfer.status} />
      </div>
      <p className="text-display text-fg tabular-nums">{formatMXN(transfer.amount)}</p>
      <dl>
        <Row term="Origen">{origin}</Row>
        <Row term="Destino">{destination}</Row>
        <Row term="Concepto">{transfer.concept}</Row>
        <Row term="Referencia">{transfer.reference}</Row>
        <Row term="Fecha">
          <time dateTime={transfer.completedAt ?? transfer.createdAt}>
            {formatDateTime(transfer.completedAt ?? transfer.createdAt)}
          </time>
        </Row>
        <Row term="Folio">
          <span className="text-body-sm break-all tabular-nums">{transfer.id}</span>
        </Row>
      </dl>
    </section>
  );
}
