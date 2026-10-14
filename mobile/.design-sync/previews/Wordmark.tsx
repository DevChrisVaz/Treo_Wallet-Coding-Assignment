import { Button, Text, View, Wordmark, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, padding: theme.spacing[4], gap: theme.spacing[3] };

const inverseFrame = {
  ...frame,
  backgroundColor: theme.colors.surface.inverse,
  borderRadius: theme.radius.md,
};

export const Full = () => (
  <View style={frame}>
    <Wordmark />
  </View>
);

export const Compact = () => (
  <View style={frame}>
    <Wordmark variant="compact" />
  </View>
);

export const Inverse = () => (
  <View style={{ ...inverseFrame, gap: theme.spacing[4] }}>
    <Wordmark tone="inverse" />
    <Wordmark tone="inverse" variant="compact" />
  </View>
);

export const LoginHeader = () => (
  <View style={{ ...frame, gap: theme.spacing[2] }}>
    <Wordmark />
    <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Inicia sesión</Text>
    <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
      Usa el correo y la contraseña de tu cuenta TreoWallet.
    </Text>
  </View>
);

export const HomeHeader = () => (
  <View style={{ ...frame, gap: theme.spacing[2] }}>
    <Wordmark variant="compact" />
    <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Tus cuentas</Text>
  </View>
);

export const StartupOffline = () => (
  <View
    style={{
      ...frame,
      alignItems: 'center',
      gap: theme.spacing[4],
      padding: theme.spacing[6],
      backgroundColor: theme.colors.surface.default,
    }}
  >
    <Wordmark />
    <Text
      style={{ ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center' }}
    >
      No pudimos conectar con TreoWallet
    </Text>
    <Text
      style={{ ...theme.typography.body, color: theme.colors.text.secondary, textAlign: 'center' }}
    >
      Revisa tu conexión e intenta de nuevo.
    </Text>
    <Button label="Reintentar" onPress={noop} />
  </View>
);
