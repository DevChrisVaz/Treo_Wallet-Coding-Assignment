import { FlowHeader } from 'wallet-web-ui';

/* Encabezado del flujo de transferencia (WEB-30): cerrar, el título del paso y el indicador. */

export const Recipient = () => (
  <div className="max-w-[390px] bg-surface-canvas">
    <FlowHeader title="¿A quién le envías?" step={1} total={5} stepLabel="Destinatario" closeHref="#" />
  </div>
);

export const Review = () => (
  <div className="max-w-[390px] bg-surface-canvas">
    <FlowHeader title="Revisa tu transferencia" step={3} total={4} stepLabel="Revisión" closeHref="#" />
  </div>
);

export const Receipt = () => (
  <div className="max-w-[390px] bg-surface-canvas">
    <FlowHeader title="Transferencia enviada" step={4} total={4} stepLabel="Comprobante" closeHref="#" />
  </div>
);
