import { MovementRow, Text, View, theme } from 'wallet-mobile-ui';

const frame = { width: 360, padding: theme.spacing[4], gap: theme.spacing[3] };

// Movimientos de la cuenta Principal (montos con signo: negativos para salidas).
const deposit = {
  id: 'mv_01J9ZK3A7Q2B',
  type: 'DEPOSIT' as const,
  amount: '25000.00',
  balanceAfter: '25000.00',
  concept: 'Depósito inicial',
  reference: '0',
  counterparty: null,
  transferId: '2c4e6a8b-0d1f-4a3c-9e5b-7d9f1b3c5e70',
  occurredAt: '2026-09-30T15:05:00Z',
};

const ownTransferOut = {
  id: 'mv_01JA4M8R2X6C',
  type: 'OWN_TRANSFER_OUT' as const,
  amount: '-3000.00',
  balanceAfter: '22000.00',
  concept: 'Ahorro quincenal',
  reference: '15',
  counterparty: { name: 'Ahorro', clabeLast4: '1234' },
  transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a',
  occurredAt: '2026-10-05T18:20:00Z',
};

const transferIn = {
  id: 'mv_01JAB2T5N9D4',
  type: 'TRANSFER_IN' as const,
  amount: '450.00',
  balanceAfter: '22450.00',
  concept: 'Pago de la comida',
  reference: '9',
  counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' },
  transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91',
  occurredAt: '2026-10-09T23:10:00Z',
};

const transferOut = {
  id: 'mv_01JAG7W1K3E8',
  type: 'TRANSFER_OUT' as const,
  amount: '-150.00',
  balanceAfter: '22300.00',
  concept: 'Despensa',
  reference: '1',
  counterparty: { name: 'Mamá', clabeLast4: '4321' },
  transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  occurredAt: '2026-10-13T01:05:00Z',
};

const rent = {
  id: 'mv_01JAH0P6Z8F2',
  type: 'TRANSFER_OUT' as const,
  amount: '-1250.00',
  balanceAfter: '21050.00',
  concept: 'Renta',
  reference: '1',
  counterparty: { name: 'Luis', clabeLast4: '5678' },
  transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b',
  occurredAt: '2026-10-13T16:42:00Z',
};

const ownTransferIn = {
  id: 'mv_01JA4M8R2X6D',
  type: 'OWN_TRANSFER_IN' as const,
  amount: '3000.00',
  balanceAfter: '13000.00',
  concept: 'Ahorro quincenal',
  reference: '15',
  counterparty: { name: 'Principal', clabeLast4: '9719' },
  transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a',
  occurredAt: '2026-10-05T18:20:00Z',
};

export const TransferSent = () => (
  <View style={frame}>
    <MovementRow timeOnly movement={transferOut} />
  </View>
);

export const TransferReceived = () => (
  <View style={frame}>
    <MovementRow timeOnly movement={transferIn} />
  </View>
);

export const Deposit = () => (
  <View style={frame}>
    <MovementRow timeOnly movement={deposit} />
  </View>
);

export const OwnAccountTransfers = () => (
  <View style={frame}>
    <MovementRow timeOnly movement={ownTransferOut} />
    <MovementRow timeOnly movement={ownTransferIn} />
  </View>
);

export const RecentMovementsList = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={{ ...theme.typography.label, color: theme.colors.text.secondary }}>
        Últimos movimientos
      </Text>
      <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Principal</Text>
    </View>
    <View>
      {[rent, transferOut, transferIn, ownTransferOut, deposit].map((movement) => (
        <MovementRow key={movement.id} movement={movement} timeOnly />
      ))}
    </View>
  </View>
);

// MOB-06: un movimiento sin referencia lleva solo la fecha u hora, sin "Ref.".
export const WithoutReference = () => (
  <View style={frame}>
    <MovementRow timeOnly movement={{ ...ownTransferOut, reference: null }} />
    <MovementRow movement={{ ...ownTransferOut, reference: null }} />
  </View>
);
