import { StatusBadge } from 'wallet-web-ui';

export const Completed = () => <StatusBadge status="COMPLETED" />;

export const AllStatuses = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="PENDING_OTP" />
    <StatusBadge status="COMPLETED" />
    <StatusBadge status="REJECTED" />
    <StatusBadge status="FAILED" />
    <StatusBadge status="EXPIRED" />
  </div>
);

export const ReceiptHeader = () => (
  <div className="grid max-w-xl gap-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-h3 text-fg">Comprobante</h2>
      <StatusBadge status="COMPLETED" />
    </div>
    <p className="text-h1 text-fg tabular-nums">$5,000.00</p>
  </div>
);

const recent = [
  { id: 't1', to: 'Luis', concept: 'Renta de octubre', amount: '$5,000.00', status: 'COMPLETED' },
  { id: 't2', to: 'Ahorro', concept: 'Ahorro quincenal', amount: '$2,500.00', status: 'PENDING_OTP' },
  { id: 't3', to: 'Mamá', concept: 'Pago de colegiatura', amount: '$15,000.00', status: 'FAILED' },
  { id: 't4', to: 'Luis', concept: 'Cena del viernes', amount: '$680.00', status: 'EXPIRED' },
] as const;

export const RecentTransfers = () => (
  <ul className="grid max-w-xl gap-3">
    {recent.map((item) => (
      <li
        key={item.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle p-4"
      >
        <div className="grid gap-0.5">
          <p className="text-label text-fg">{item.to}</p>
          <p className="text-body-sm text-fg-secondary">{item.concept}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-body text-fg tabular-nums">{item.amount}</span>
          <StatusBadge status={item.status} />
        </div>
      </li>
    ))}
  </ul>
);
