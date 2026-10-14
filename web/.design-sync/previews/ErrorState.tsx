import { ErrorState, MovementRow, buttonClasses } from 'wallet-web-ui';

/*
 * Sin respuesta del servidor (el `fetch` falla), ErrorState muestra el mensaje de conexión. Los
 * mensajes por `code` necesitan un ProblemError del contrato, que este paquete no exporta.
 */
const offline = new TypeError('Failed to fetch');
const retry = () => {};

export const Default = () => (
  <div className="max-w-xl">
    <ErrorState title="No pudimos cargar tus cuentas" error={offline} onRetry={retry} />
  </div>
);

export const WithDetails = () => (
  <div className="max-w-xl">
    <ErrorState title="No pudimos cargar la transferencia" error={offline} onRetry={retry}>
      <p>Tu transferencia no se ve afectada: solo no pudimos mostrar su estado.</p>
    </ErrorState>
  </div>
);

export const BeneficiariesScreen = () => (
  <div className="grid max-w-3xl gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1">Beneficiarios</h1>
      <a href="#" className={buttonClasses('primary')}>
        Agregar beneficiario
      </a>
    </div>
    <ErrorState title="No pudimos cargar tus beneficiarios" error={offline} onRetry={retry} />
  </div>
);

export const LoadMoreFailed = () => (
  <section className="grid max-w-3xl gap-4">
    <ul aria-label="Movimientos">
      <MovementRow
        movement={{
          id: '01JA8Z3K5Q7M2N4P6R8T0V2X4Z',
          type: 'TRANSFER_IN',
          amount: '1500.00',
          balanceAfter: '26949.50',
          concept: 'Renta de octubre',
          reference: '1234',
          counterparty: { name: 'Luis Pérez Ramírez', clabeLast4: '9735' },
          transferId: '3e0a9c8b-7f6e-4d5c-8b4a-9c8b7a6f5e4d',
          occurredAt: '2026-10-13T16:42:00.000Z',
        }}
      />
      <MovementRow
        movement={{
          id: '01JA6W1H3M5K7N9Q1S3U5W7Y9A',
          type: 'TRANSFER_OUT',
          amount: '-850.50',
          balanceAfter: '25449.50',
          concept: 'Cena de cumpleaños',
          reference: '2048',
          counterparty: { name: 'Mariana', clabeLast4: '4410' },
          transferId: '7b2d4f6a-8c0e-4a1b-9d3f-5e7a9c1b3d5f',
          occurredAt: '2026-10-12T23:15:00.000Z',
        }}
      />
    </ul>
    <ErrorState title="No pudimos cargar más movimientos" error={offline} onRetry={retry} />
  </section>
);
