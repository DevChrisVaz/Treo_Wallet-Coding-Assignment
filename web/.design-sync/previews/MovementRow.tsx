import { Button, MovementRow } from 'wallet-web-ui';

/* Historial de la cuenta Principal, del más reciente al más antiguo; el saldo cuadra entre filas. */
const received = {
  id: '01JA8Z3K5Q7M2N4P6R8T0V2X4Z',
  type: 'TRANSFER_IN' as const,
  amount: '1500.00',
  balanceAfter: '26949.50',
  concept: 'Renta de octubre',
  reference: '1234',
  counterparty: { name: 'Luis Pérez Ramírez', clabeLast4: '9735' },
  transferId: '3e0a9c8b-7f6e-4d5c-8b4a-9c8b7a6f5e4d',
  occurredAt: '2026-10-13T16:42:00.000Z',
};

const sent = {
  id: '01JA6W1H3M5K7N9Q1S3U5W7Y9A',
  type: 'TRANSFER_OUT' as const,
  amount: '-850.50',
  balanceAfter: '25449.50',
  concept: 'Cena de cumpleaños',
  reference: '2048',
  counterparty: { name: 'Mariana', clabeLast4: '4410' },
  transferId: '7b2d4f6a-8c0e-4a1b-9d3f-5e7a9c1b3d5f',
  occurredAt: '2026-10-12T23:15:00.000Z',
};

const ownOut = {
  id: '01JA2R8F0K2H4J6L8N0P2R4T6V',
  type: 'OWN_TRANSFER_OUT' as const,
  amount: '-2500.00',
  balanceAfter: '26300.00',
  concept: 'Ahorro quincenal',
  reference: '15',
  counterparty: { name: 'Ahorro', clabeLast4: '9722' },
  transferId: '9a2c4e6f-1b3d-4f5a-8c7e-2d4f6a8b0c1e',
  occurredAt: '2026-10-10T15:05:00.000Z',
};

const tuition = {
  id: '01J9YM5C7E9G1J3L5N7Q9S1U3W',
  type: 'TRANSFER_OUT' as const,
  amount: '-1200.00',
  balanceAfter: '28800.00',
  concept: 'Clases de inglés',
  reference: '8',
  counterparty: { name: 'Sofía', clabeLast4: '2286' },
  transferId: '5c7e9a1b-3d5f-4b7c-9e1a-3b5d7f9a1c3e',
  occurredAt: '2026-10-08T19:30:00.000Z',
};

const deposit = {
  id: '01J9QD2A4C6E8G0J2L4N6Q8S0U',
  type: 'DEPOSIT' as const,
  amount: '30000.00',
  balanceAfter: '30000.00',
  concept: 'Depósito inicial',
  reference: '1',
  counterparty: null,
  transferId: '1f3b5d7f-9a1c-4e3a-8c5e-7a9c1e3b5d7f',
  occurredAt: '2026-10-01T15:00:00.000Z',
};

/* Traspaso visto desde la cuenta Ahorro (la otra cara de `ownOut`). */
const ownIn = {
  ...ownOut,
  id: '01JA2R8F0K2H4J6L8N0P2R4T6W',
  type: 'OWN_TRANSFER_IN' as const,
  amount: '2500.00',
  balanceAfter: '12500.00',
  counterparty: { name: 'Principal', clabeLast4: '9719' },
};

export const TransferReceived = () => (
  <ul aria-label="Movimientos" className="max-w-xl">
    <MovementRow movement={received} />
  </ul>
);

export const TransferSent = () => (
  <ul aria-label="Movimientos" className="max-w-xl">
    <MovementRow movement={sent} />
  </ul>
);

export const Deposit = () => (
  <ul aria-label="Movimientos" className="max-w-xl">
    <MovementRow movement={deposit} />
  </ul>
);

export const OwnAccountTransfers = () => (
  <ul aria-label="Traspasos entre tus cuentas" className="max-w-xl">
    <MovementRow movement={ownOut} />
    <MovementRow movement={ownIn} />
  </ul>
);

export const MovementHistory = () => (
  <section className="grid max-w-3xl gap-4">
    <ul aria-label="Movimientos">
      {[received, sent, ownOut, tuition, deposit].map((item) => (
        <MovementRow key={item.id} movement={item} />
      ))}
    </ul>
    <div>
      <Button variant="secondary">Cargar más</Button>
    </div>
  </section>
);
