import { Button, InlineAlert, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, gap: theme.spacing[3], padding: theme.spacing[4] };

export const Tones = () => (
  <View style={frame}>
    <InlineAlert tone="success" message="Tu transferencia se completó. Ya la ves en tus movimientos." />
    <InlineAlert
      tone="info"
      message="Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo."
    />
    <InlineAlert
      tone="warning"
      message="Cerramos tu sesión por seguridad. Inicia sesión de nuevo."
    />
    <InlineAlert tone="danger" message="No tienes saldo suficiente para esta transferencia." />
  </View>
);

export const WithTitle = () => (
  <View style={frame}>
    <InlineAlert
      tone="warning"
      title="No pudimos confirmar el estado de tu transferencia"
      message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces."
    />
    <Button label="Reintentar" onPress={noop} />
  </View>
);

export const LoadError = () => (
  <View style={frame}>
    <InlineAlert
      tone="danger"
      message="No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo."
    />
    <Button label="Reintentar" variant="secondary" onPress={noop} />
  </View>
);

export const RateLimited = () => (
  <View style={frame}>
    <InlineAlert
      tone="warning"
      message="Hiciste demasiados intentos. Espera un momento y vuelve a intentar."
    />
    <Text style={{ ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary }}>
      Podrás reintentar en 42 s, con la misma operación.
    </Text>
    <Button label="Reintentar" disabled onPress={noop} />
  </View>
);

export const RejectedTransfer = () => (
  <View style={frame}>
    <InlineAlert
      tone="danger"
      message="Esta transferencia supera lo que te queda del límite de hoy. Hoy te quedan $31,500.00."
    />
    <Button label="Corregir" variant="secondary" onPress={noop} />
  </View>
);
