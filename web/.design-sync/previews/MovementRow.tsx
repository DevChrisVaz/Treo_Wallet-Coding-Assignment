import { ListSection, MovementRow } from 'wallet-web-ui';

/*
 * Movimientos de la cuenta Principal (del más reciente al más antiguo; el saldo cuadra entre filas).
 * Con `timeOnly`, solo la hora a la vista y sin borde: así los pone MovementList bajo su encabezado
 * de día, dentro de una ListSection. Sin él (por omisión), fecha completa y borde inferior, para
 * listas sin agrupar.
 */
const received = {
  id: '01JA8Z3K5Q7M2N4P6R8T0V2X4Z',
  type: 'TRANSFER_IN' as const,
  amount: '1500.00',
  balanceAfter: '26949.50',
  concept: 'Renta de octubre',
  reference: '1234',
  counterparty: { name: 'Luis Pérez Ramírez', clabeLast4: '5678' },
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
  counterparty: { name: 'María Gómez', clabeLast4: '4321' },
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
  counterparty: { name: 'Ahorro', clabeLast4: '1234' },
  transferId: '9a2c4e6f-1b3d-4f5a-8c7e-2d4f6a8b0c1e',
  occurredAt: '2026-10-10T15:05:00.000Z',
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
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <ul aria-label="Movimientos">
        <MovementRow timeOnly movement={received} />
      </ul>
    </ListSection>
  </div>
);

export const TransferSent = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <ul aria-label="Movimientos">
        <MovementRow timeOnly movement={sent} />
      </ul>
    </ListSection>
  </div>
);

export const Deposit = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <ul aria-label="Movimientos">
        <MovementRow timeOnly movement={deposit} />
      </ul>
    </ListSection>
  </div>
);

export const OwnAccountTransfers = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <ul aria-label="Traspasos entre tus cuentas">
        <MovementRow timeOnly movement={ownOut} />
        <MovementRow timeOnly movement={ownIn} />
      </ul>
    </ListSection>
  </div>
);

/** Sin `timeOnly`: fecha y hora completas y borde entre filas, para una lista sin días. */
export const FullDate = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <ul aria-label="Movimientos">
        {[received, sent, ownOut, deposit].map((item) => (
          <MovementRow key={item.id} movement={item} />
        ))}
      </ul>
    </ListSection>
  </div>
);

/** WEB-16: un movimiento sin referencia (`null`) no muestra "Ref.". */
export const WithoutReference = () => (
  <ul aria-label="Movimientos" className="max-w-xl">
    <MovementRow timeOnly movement={{ ...sent, reference: null }} />
  </ul>
);
