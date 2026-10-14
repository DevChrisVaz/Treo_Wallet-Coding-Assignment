import { Receipt } from 'wallet-web-ui';

/*
 * Comprobantes sobre el lienzo de la app, como en el último paso del flujo y en el detalle de una
 * transferencia: sin título visible (el encabezado es solo para lectores de pantalla), con el icono
 * en el tono del estado y la cuenta de origen como "Principal · •••• 9719".
 */

const principal = { name: 'Principal', clabe: '032180000118359719' };

const completed = {
  id: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
  status: 'COMPLETED' as const,
  kind: 'THIRD_PARTY' as const,
  fromAccountId: '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a',
  destination: {
    type: 'BENEFICIARY' as const,
    accountId: null,
    beneficiaryId: '2d9f8b7a-6e5d-4c4b-8a39-8b7a6f5e4d3c',
    displayName: 'Luis',
    clabeLast4: '9735',
  },
  amount: '5000.00',
  concept: 'Renta de octubre',
  reference: '1024',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  createdAt: '2026-10-13T16:42:00.000Z',
  completedAt: '2026-10-13T16:42:01.000Z',
};

export const Completed = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <Receipt transfer={completed} fromAccount={principal} />
  </div>
);

export const OwnAccountTransfer = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <Receipt
      transfer={{
        ...completed,
        id: '9a2c4e6f-1b3d-4f5a-8c7e-2d4f6a8b0c1e',
        kind: 'OWN',
        destination: {
          type: 'OWN_ACCOUNT',
          accountId: '1c8e7a6f-5d4c-4b3a-9298-7a6f5e4d3c2b',
          beneficiaryId: null,
          displayName: 'Ahorro',
          clabeLast4: '9722',
        },
        amount: '2500.00',
        concept: 'Ahorro quincenal',
        reference: '15',
      }}
      fromAccount={principal}
    />
  </div>
);

export const Failed = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <Receipt
      transfer={{
        ...completed,
        id: '6c3e5a7b-9d1f-4b2c-8e4a-6b8d0f2a4c6e',
        status: 'FAILED',
        amount: '15000.00',
        concept: 'Pago de colegiatura',
        reference: '7',
        completedAt: null,
        failureReason: 'INSUFFICIENT_FUNDS',
      }}
      fromAccount={principal}
    />
  </div>
);

/**
 * Bonus (WEB-34): la programada canónica, $1,000.00 a Luis para el 20 de octubre de 2026. La
 * insignia "Programada" va en el tono informativo y el comprobante agrega "Programada para".
 */
const scheduled = {
  ...completed,
  id: '9a3b5c7d-2e4f-4a6b-8c0d-1e3f5a7b9c2d',
  status: 'SCHEDULED' as const,
  destination: { ...completed.destination, clabeLast4: '5678' },
  amount: '1000.00',
  concept: 'Renta',
  reference: '1',
  scheduledFor: '2026-10-20',
  cancelledAt: null,
  createdAt: '2026-10-13T16:50:00.000Z',
  completedAt: null,
};

export const Scheduled = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <Receipt transfer={scheduled} fromAccount={principal} />
  </div>
);

/** La misma, cancelada: "Cancelada" en el tono neutro; la fecha programada sigue a la vista. */
export const Cancelled = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <Receipt
      transfer={{ ...scheduled, status: 'CANCELLED', cancelledAt: '2026-10-14T15:00:00.000Z' }}
      fromAccount={principal}
    />
  </div>
);
