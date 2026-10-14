import { ListSection } from '@/components/ui/ListSection';
import type { SummaryRows } from '@/lib/client/transfer-steps';
import { scheduledSendText } from './ScheduleField';

/** Fila etiqueta / valor del resumen (revisión y panel lateral). */
export function SummaryRow({ term, value }: { term: string; value: string | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className={`text-right text-label tabular-nums ${value ? 'text-fg' : 'text-fg-muted'}`}>
        {value ?? 'Por definir'}
      </dd>
    </div>
  );
}

/** El monto protagonista de la revisión y del código. */
export function AmountBlock({ amount, caption }: { amount: string; caption?: string }) {
  return (
    <div className="grid justify-items-center gap-1 py-2 text-center">
      <p className="text-label text-fg-secondary">Monto</p>
      <p className="text-display text-fg tabular-nums">{amount}</p>
      {caption ? <p className="text-body-sm text-fg-secondary">{caption}</p> : null}
    </div>
  );
}

/**
 * Resumen lateral del dashboard (WEB-30): lo que lleva capturado la transferencia y, si es
 * programada, cuándo se enviará (WEB-33).
 */
export function TransferSummary({ rows, note }: { rows: SummaryRows; note: string }) {
  return (
    <ListSection title="Resumen" className="hidden self-start dashboard:block">
      <dl className="divide-y divide-border">
        <SummaryRow term="Desde" value={rows.desde} />
        <SummaryRow term="Para" value={rows.para} />
        <SummaryRow term="Monto" value={rows.monto} />
        <SummaryRow term="Concepto" value={rows.concepto} />
        <SummaryRow term="Referencia" value={rows.referencia} />
        {rows.programada ? (
          <SummaryRow term="Cuándo" value={scheduledSendText(rows.programada)} />
        ) : null}
      </dl>
      <p className="border-t border-border pt-3 text-caption text-fg-muted">{note}</p>
    </ListSection>
  );
}
