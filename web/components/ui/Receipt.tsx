import { formatMXN, type Account, type Transfer } from '@devchrisvaz/wallet-contract';
import { toneIcon } from '@devchrisvaz/wallet-design-tokens';
import { useId, type ReactNode } from 'react';
import { TRANSFER_STATUS } from '@/lib/conventions';
import { formatDateTime } from '@/lib/format';
import { maskClabe } from '@/lib/money';
import { formatScheduledDate } from '@/lib/scheduled-date';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

export interface ReceiptProps {
  transfer: Transfer;
  /** Cuenta de origen, si se conoce, para mostrar su nombre y CLABE enmascarada. */
  fromAccount?: Pick<Account, 'name' | 'clabe'> | undefined;
}

/**
 * " · " entre el nombre y la terminación de la CLABE, como en la revisión y en la app móvil (WEB-25).
 * Es texto (se copia y se busca igual que en la revisión); el punto es decorativo, así que un lector de
 * pantalla lee solo el nombre y la terminación.
 */
function Separator() {
  return (
    <>
      {' '}
      <span aria-hidden="true">·</span>{' '}
    </>
  );
}

/**
 * Dato del comprobante. En la forma de app, etiqueta pequeña sobre el valor y 12 px entre datos, como
 * en la app móvil (WEB-25); en el dashboard, en dos columnas con divisores.
 */
function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 dashboard:grid-cols-3 dashboard:gap-4 dashboard:border-b dashboard:border-border dashboard:py-3">
      <dt className="text-caption text-fg-secondary dashboard:text-body-sm">{term}</dt>
      <dd className="text-body text-fg dashboard:col-span-2">{children}</dd>
    </div>
  );
}

/**
 * Comprobante (D7 de design-system, WEB-16): estado, monto, origen, destino, concepto, referencia,
 * fecha programada si la tiene (WEB-34), fecha y folio (`transferId`). El icono sigue el tono del
 * estado, como la insignia: éxito, error (fallida o rechazada), aviso (pendiente) o información
 * (vencida, programada o cancelada). El título "Comprobante" nombra la región para lectores de
 * pantalla; a la vista, el paso del flujo ya lo dice y la tarjeta empieza con el icono y el estado,
 * como en la app móvil (WEB-25).
 */
export function Receipt({ transfer, fromAccount }: ReceiptProps) {
  const titleId = useId();
  const origin = fromAccount ? (
    <>
      {fromAccount.name}
      <Separator />
      {maskClabe(fromAccount.clabe)}
    </>
  ) : (
    transfer.fromAccountId
  );
  const destination = (
    <>
      {transfer.destination.displayName}
      <Separator />
      {`•••• ${transfer.destination.clabeLast4}`}
    </>
  );

  return (
    <section
      aria-labelledby={titleId}
      className="grid justify-items-start gap-3 rounded-lg bg-surface p-6 shadow-card"
    >
      <h2 id={titleId} className="sr-only">
        Comprobante
      </h2>
      <Avatar
        size="lg"
        tone={transfer.status === 'COMPLETED' ? 'success' : 'neutral'}
        icon={toneIcon[TRANSFER_STATUS[transfer.status].tone]}
      />
      <StatusBadge status={transfer.status} />
      <p className="text-display text-fg tabular-nums">{formatMXN(transfer.amount)}</p>
      <dl className="grid gap-3 justify-self-stretch dashboard:gap-0">
        <Row term="Origen">{origin}</Row>
        <Row term="Destino">{destination}</Row>
        <Row term="Concepto">{transfer.concept}</Row>
        <Row term="Referencia">{transfer.reference}</Row>
        {transfer.scheduledFor ? (
          <Row term="Programada para">
            <time dateTime={transfer.scheduledFor}>
              {formatScheduledDate(transfer.scheduledFor)}
            </time>
          </Row>
        ) : null}
        <Row term="Fecha">
          <time dateTime={transfer.completedAt ?? transfer.createdAt}>
            {formatDateTime(transfer.completedAt ?? transfer.createdAt)}
          </time>
        </Row>
        <Row term="Folio">
          <span className="break-words">{transfer.id}</span>
        </Row>
      </dl>
    </section>
  );
}
