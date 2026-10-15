import { Button, InlineAlert, OtpField, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Lienzo de la app (surface.canvas) a ancho de teléfono, con el margen de pantalla.
const frame = {
  width: 390,
  gap: theme.spacing[4],
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

const body = { ...theme.typography.body, color: theme.colors.text.primary };
const meta = { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary };

export const Default = () => (
  <View style={frame}>
    <OtpField value="" onChangeText={noop} />
  </View>
);

export const Filled = () => (
  <View style={frame}>
    <OtpField value="482913" onChangeText={noop} />
  </View>
);

export const WithError = () => (
  <View style={frame}>
    <OtpField
      value="482910"
      error="El código no es correcto. Te quedan 2 intentos."
      onChangeText={noop}
    />
  </View>
);

export const Confirming = () => (
  <View style={frame}>
    <OtpField value="482913" disabled onChangeText={noop} />
    <Button label="Confirmar" loading onPress={noop} />
  </View>
);

// El paso "Código" del flujo: el aviso, el vencimiento, los intentos y el campo (en la app, las
// acciones van en el pie fijo de la pantalla).
export const ConfirmationStep = () => (
  <View style={frame}>
    <Text style={body}>Te enviamos un código de 6 dígitos a an***@example.com.</Text>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={meta}>El código vence en 4:32.</Text>
      <Text style={meta}>Te quedan 3 intentos.</Text>
    </View>
    <OtpField value="482913" onChangeText={noop} />
    <Button label="Confirmar" onPress={noop} />
    <Button label="Reenviar código" variant="ghost" onPress={noop} />
  </View>
);

export const DeliveryFailed = () => (
  <View style={frame}>
    <Text style={body}>Te enviamos un código de 6 dígitos a an***@example.com.</Text>
    <InlineAlert
      tone="warning"
      message="No pudimos enviarte el código. Reenvíalo para recibir uno nuevo."
    />
    <OtpField value="" onChangeText={noop} />
    <Button label="Reenviar código" variant="ghost" onPress={noop} />
  </View>
);
