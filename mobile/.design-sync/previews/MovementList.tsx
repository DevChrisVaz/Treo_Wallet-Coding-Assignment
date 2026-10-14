import { MovementList, View, theme } from 'wallet-mobile-ui';

// Movimientos agrupados por día de Ciudad de México (MOB-20). "Ahora" es el 13 oct 2026, 12:00.
const NOW = new Date('2026-10-13T18:00:00Z');
const frame = { width: 390, paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[3] };

const movements = [
  { id: 'mv-1', type: 'TRANSFER_OUT' as const, amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN' as const, amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
  { id: 'mv-3', type: 'TRANSFER_OUT' as const, amount: '-150.00', balanceAfter: '25800.00', concept: 'Despensa', reference: '1', counterparty: { name: 'Mamá', clabeLast4: '4321' }, transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b', occurredAt: '2026-10-12T15:05:00Z' },
  { id: 'mv-4', type: 'OWN_TRANSFER_OUT' as const, amount: '-3000.00', balanceAfter: '25950.00', concept: 'Ahorro quincenal', reference: '15', counterparty: { name: 'Ahorro', clabeLast4: '1234' }, transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a', occurredAt: '2026-10-09T18:20:00Z' },
  { id: 'mv-5', type: 'DEPOSIT' as const, amount: '28950.00', balanceAfter: '28950.00', concept: 'Depósito inicial', reference: '1', counterparty: null, transferId: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b', occurredAt: '2026-09-30T15:05:00Z' },
];

export const Today = () => (
  <View style={frame}>
    <MovementList movements={movements.slice(0, 1)} now={NOW} />
  </View>
);

// Hoy, Ayer y fechas cortas: los últimos movimientos de Principal.
export const AcrossDays = () => (
  <View style={frame}>
    <MovementList movements={movements} now={NOW} />
  </View>
);

// 06:30 UTC del 13 es 00:30 en Ciudad de México (Hoy); 05:30 UTC es 23:30 del día anterior (Ayer).
export const AroundMidnight = () => (
  <View style={frame}>
    <MovementList
      now={NOW}
      movements={[
        { ...movements[2]!, id: 'mv-a', amount: '-320.00', balanceAfter: '24680.00', concept: 'Medicinas', occurredAt: '2026-10-13T06:30:00Z' },
        { ...movements[1]!, id: 'mv-b', amount: '600.00', balanceAfter: '25000.00', concept: 'Cena', occurredAt: '2026-10-13T05:30:00Z' },
      ]}
    />
  </View>
);

// Movimientos de otro año: la fecha lleva el año para no confundir diciembre con enero.
export const PreviousYear = () => (
  <View style={frame}>
    <MovementList
      now={NOW}
      movements={[
        { ...movements[1]!, id: 'mv-c', amount: '1200.00', balanceAfter: '9200.00', concept: 'Viaje', occurredAt: '2026-01-02T18:00:00Z' },
        { ...movements[2]!, id: 'mv-d', amount: '-800.00', balanceAfter: '8000.00', concept: 'Posada', occurredAt: '2025-12-28T18:00:00Z' },
      ]}
    />
  </View>
);
