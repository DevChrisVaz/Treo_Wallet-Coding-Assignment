import { Button, Text, View, Wordmark, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Sobre el lienzo de la app y, en su tono inverso, sobre la superficie de marca (BrandScreen, la
// pantalla de privacidad).
const frame = {
  width: 390,
  padding: theme.spacing[5],
  gap: theme.spacing[3],
  backgroundColor: theme.colors.surface.canvas,
};

const brandFrame = {
  ...frame,
  backgroundColor: theme.colors.surface.hero,
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
  <View style={{ ...brandFrame, gap: theme.spacing[4] }}>
    <Wordmark tone="inverse" />
    <Wordmark tone="inverse" variant="compact" />
  </View>
);

// El encabezado de BrandScreen (inicio de sesión y pantalla de bloqueo).
export const BrandHeader = () => (
  <View
    style={{
      ...brandFrame,
      gap: theme.spacing[3],
      paddingTop: theme.spacing[16],
      paddingBottom: theme.spacing[8],
    }}
  >
    <Wordmark tone="inverse" />
    <Text style={{ ...theme.typography.body, color: theme.colors.text.onHeroMuted }}>
      Tu billetera digital en pesos mexicanos.
    </Text>
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
