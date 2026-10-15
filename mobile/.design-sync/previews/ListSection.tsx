import {
  Avatar,
  DailyLimitMeter,
  Icon,
  ListSection,
  MovementList,
  Pressable,
  StyleSheet,
  Text,
  View,
  initials,
  theme,
} from 'wallet-mobile-ui';

const noop = () => {};

// Tarjeta de lista sobre el fondo de la app, con el margen de pantalla.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

const NOW = new Date('2026-10-13T18:00:00Z');
const recent = [
  { id: 'mv-1', type: 'TRANSFER_OUT' as const, amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN' as const, amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
];

const row = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: theme.spacing[3],
  minHeight: theme.touchTarget,
  paddingVertical: theme.spacing[3],
};
const divider = {
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: theme.colors.border.default,
};
const label = { ...theme.typography.bodySm, color: theme.colors.text.secondary };
const value = { ...theme.typography.label, color: theme.colors.text.primary };

export const RecentMovements = () => (
  <View style={frame}>
    <ListSection
      title="Últimos movimientos"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todos los movimientos"
          onPress={noop}
          style={{ minHeight: theme.touchTarget, justifyContent: 'center' }}
        >
          <Text style={{ ...theme.typography.label, color: theme.colors.action.primary }}>
            Ver todos
          </Text>
        </Pressable>
      }
    >
      <MovementList movements={recent} now={NOW} />
    </ListSection>
  </View>
);

// Sin título: el medidor trae su propio encabezado.
export const DailyLimit = () => (
  <View style={frame}>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
    </ListSection>
  </View>
);

// MOB-21: sin referencia, la revisión no lleva la fila "Referencia". Diseño objetivo, pendiente en la
// vista de revisión (hoy muestra la fila vacía).
export const TransferSummaryWithoutReference = () => (
  <View style={frame}>
    <ListSection>
      {[
        ['Desde', 'Principal · •••• 9719'],
        ['Para', 'Luis · •••• 5678'],
        ['Concepto', 'Renta'],
      ].map(([name, text], index) => (
        <View key={name} style={[row, index > 0 ? divider : null]}>
          <Text style={label}>{name}</Text>
          <View style={{ flex: 1 }} />
          <Text style={value}>{text}</Text>
        </View>
      ))}
    </ListSection>
  </View>
);

// Resumen de la revisión de una transferencia: etiqueta a la izquierda y valor a la derecha.
export const TransferSummary = () => (
  <View style={frame}>
    <ListSection>
      {[
        ['Desde', 'Principal · •••• 9719'],
        ['Para', 'Luis · •••• 5678'],
        ['Concepto', 'Renta'],
        ['Referencia', '1'],
      ].map(([name, text], index) => (
        <View key={name} style={[row, index > 0 ? divider : null]}>
          <Text style={label}>{name}</Text>
          <View style={{ flex: 1 }} />
          <Text style={value}>{text}</Text>
        </View>
      ))}
    </ListSection>
  </View>
);

export const Beneficiaries = () => (
  <View style={frame}>
    <ListSection title="Beneficiarios">
      {[
        { alias: 'Luis', name: 'Luis Pérez Ramírez', last4: '5678' },
        { alias: 'Mamá', name: 'María Gómez', last4: '4321' },
      ].map((beneficiary, index) => (
        <Pressable
          key={beneficiary.alias}
          accessibilityRole="button"
          accessibilityLabel={`${beneficiary.alias}, ${beneficiary.name}, CLABE terminación ${beneficiary.last4}`}
          onPress={noop}
          style={[row, index > 0 ? divider : null]}
        >
          <Avatar initials={initials(beneficiary.name)} />
          <View style={{ flex: 1, gap: theme.spacing[1] }}>
            <Text style={value}>{beneficiary.alias}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              {`${beneficiary.name} · CLABE •••• ${beneficiary.last4}`}
            </Text>
          </View>
          <Icon name="forward" color={theme.colors.text.muted} />
        </Pressable>
      ))}
    </ListSection>
  </View>
);
