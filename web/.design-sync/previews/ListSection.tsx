import { DailyLimitMeter, ListSection, MovementList } from 'wallet-web-ui';

/* Tarjeta de lista (DSG-17): blanca sobre el lienzo, con título y acción opcionales. */

const NOW = new Date('2026-10-13T18:00:00Z');
const movements = [
  { id: 'mv-1', type: 'TRANSFER_OUT' as const, amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN' as const, amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
];
const dailyLimit = { limit: '50000.00', used: '18500.00', remaining: '31500.00', resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' as const };

export const WithTitleAndAction = () => (
  <div className="max-w-md bg-surface-canvas p-4">
    <ListSection
      title="Últimos movimientos"
      action={
        <a href="#" className="inline-flex min-h-11 items-center text-label text-action">
          Ver todos
        </a>
      }
    >
      <MovementList movements={movements} now={NOW} />
    </ListSection>
  </div>
);

export const Untitled = () => (
  <div className="max-w-md bg-surface-canvas p-4">
    <ListSection>
      <DailyLimitMeter dailyLimit={dailyLimit} showHeader />
    </ListSection>
  </div>
);

/** Filas etiqueta / valor, como el resumen de la revisión. */
export const SummaryRows = () => (
  <div className="max-w-md bg-surface-canvas p-4">
    <ListSection title="Resumen">
      <dl className="divide-y divide-border">
        {[
          ['Desde', 'Principal · •••• 9719'],
          ['Para', 'Luis · •••• 5678'],
          ['Concepto', 'Renta'],
          ['Referencia', '1'],
        ].map(([term, value]) => (
          <div key={term} className="flex min-h-11 items-center justify-between gap-4 py-3">
            <dt className="text-body-sm text-fg-secondary">{term}</dt>
            <dd className="text-right text-label text-fg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </ListSection>
  </div>
);
