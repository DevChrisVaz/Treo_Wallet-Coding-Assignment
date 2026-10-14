import { Stepper, View, theme } from 'wallet-mobile-ui';

// Indicador de pasos del flujo de transferencia (MOB-21), con el margen de pantalla.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

export const Step1 = () => (
  <View style={frame}>
    <Stepper current={1} total={5} label="Destinatario" />
  </View>
);

// Sin código: Destinatario, Monto, Revisión y Comprobante.
export const Step3 = () => (
  <View style={frame}>
    <Stepper current={3} total={4} label="Revisión" />
  </View>
);

export const Last = () => (
  <View style={frame}>
    <Stepper current={5} total={5} label="Comprobante" />
  </View>
);
