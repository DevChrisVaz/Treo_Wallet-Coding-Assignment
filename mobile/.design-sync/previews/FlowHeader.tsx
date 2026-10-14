import { FlowHeader, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Encabezado del flujo de transferencia (MOB-21), sobre el fondo de la app y a todo el ancho.
const frame = { width: 390, backgroundColor: theme.colors.surface.canvas };

export const Recipient = () => (
  <View style={frame}>
    <FlowHeader
      title="¿A quién le envías?"
      step={1}
      total={5}
      stepLabel="Destinatario"
      onClose={noop}
    />
  </View>
);

// Sin código (monto de hasta $10,000.00): el flujo tiene 4 pasos.
export const Review = () => (
  <View style={frame}>
    <FlowHeader
      title="Revisa tu transferencia"
      step={3}
      total={4}
      stepLabel="Revisión"
      onClose={noop}
    />
  </View>
);

export const Otp = () => (
  <View style={frame}>
    <FlowHeader
      title="Confirma con tu código"
      step={4}
      total={5}
      stepLabel="Código"
      onClose={noop}
    />
  </View>
);
