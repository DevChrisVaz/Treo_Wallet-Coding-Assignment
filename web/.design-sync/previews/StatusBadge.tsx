import { ListSection, StatusBadge } from 'wallet-web-ui';

/*
 * Insignias de estado (24 px de alto, siempre con etiqueta). En las pantallas rediseñadas van dentro
 * del comprobante (Receipt), sobre blanco: aquí, en una ListSection sobre el lienzo. El fondo neutro
 * (Vencida, Cancelada) es el mismo color que el lienzo, así que sobre él no se vería la píldora.
 */

export const Completed = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <StatusBadge status="COMPLETED" />
    </ListSection>
  </div>
);

export const AllStatuses = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status="PENDING_OTP" />
        <StatusBadge status="COMPLETED" />
        <StatusBadge status="REJECTED" />
        <StatusBadge status="FAILED" />
        <StatusBadge status="EXPIRED" />
        {/* Bonus (WEB-34, DSG-18): programada en el tono informativo y cancelada en el neutro. */}
        <StatusBadge status="SCHEDULED" />
        <StatusBadge status="CANCELLED" />
      </div>
    </ListSection>
  </div>
);
