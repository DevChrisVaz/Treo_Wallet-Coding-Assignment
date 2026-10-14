import { ErrorState, ListSection, MovementList } from 'wallet-web-ui';

/*
 * Sin respuesta del servidor (el `fetch` falla), ErrorState muestra el mensaje de conexión; los
 * mensajes por `code` necesitan un ProblemError del contrato, que este paquete no exporta. En las
 * pantallas rediseñadas va directo sobre el lienzo, con "Reintentar" fuera de la alerta.
 */
const offline = new TypeError('Failed to fetch');
const retry = () => {};
const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 en Ciudad de México

export const Default = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ErrorState title="No pudimos cargar tus cuentas" error={offline} onRetry={retry} />
  </div>
);

export const WithDetails = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ErrorState title="No pudimos cargar la transferencia" error={offline} onRetry={retry}>
      <p>Tu transferencia no se ve afectada: solo no pudimos mostrar su estado.</p>
    </ErrorState>
  </div>
);

/** Movimientos: la primera página llegó y "Cargar más" falló; el error va debajo de la lista. */
export const LoadMoreFailed = () => (
  <section aria-label="Movimientos" className="grid max-w-xl gap-5 bg-surface-canvas p-5">
    <ListSection>
      <MovementList
        now={NOW}
        headingLevel={2}
        movements={[
          {
            id: '01JA8Z3K5Q7M2N4P6R8T0V2X4Z',
            type: 'TRANSFER_IN',
            amount: '1500.00',
            balanceAfter: '26949.50',
            concept: 'Renta de octubre',
            reference: '1234',
            counterparty: { name: 'Luis Pérez Ramírez', clabeLast4: '5678' },
            transferId: '3e0a9c8b-7f6e-4d5c-8b4a-9c8b7a6f5e4d',
            occurredAt: '2026-10-13T16:42:00.000Z',
          },
          {
            id: '01JA6W1H3M5K7N9Q1S3U5W7Y9A',
            type: 'TRANSFER_OUT',
            amount: '-850.50',
            balanceAfter: '25449.50',
            concept: 'Cena de cumpleaños',
            reference: '2048',
            counterparty: { name: 'María Gómez', clabeLast4: '4321' },
            transferId: '7b2d4f6a-8c0e-4a1b-9d3f-5e7a9c1b3d5f',
            occurredAt: '2026-10-12T23:15:00.000Z',
          },
        ]}
      />
    </ListSection>
    <ErrorState title="No pudimos cargar más movimientos" error={offline} onRetry={retry} />
  </section>
);
