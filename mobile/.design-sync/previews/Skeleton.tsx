import { Skeleton, Text, View, Wordmark, theme } from 'wallet-mobile-ui';

const frame = { width: 360, gap: theme.spacing[3], padding: theme.spacing[4] };

const overline = { ...theme.typography.label, color: theme.colors.text.secondary };
const title = { ...theme.typography.h1, color: theme.colors.text.primary };

export const Line = () => (
  <View style={frame}>
    <Skeleton variant="line" />
    <Skeleton variant="line" />
    <Skeleton variant="line" />
  </View>
);

export const Card = () => (
  <View style={frame}>
    <Skeleton variant="card" />
  </View>
);

// Carga de "Tus cuentas": límite diario y dos tarjetas de cuenta.
export const AccountsLoading = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[2] }}>
      <Wordmark variant="compact" />
      <Text style={title}>Tus cuentas</Text>
    </View>
    <View style={{ gap: theme.spacing[4] }}>
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </View>
  </View>
);

// Carga de los últimos movimientos de una cuenta.
export const MovementsLoading = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={overline}>Últimos movimientos</Text>
      <Text style={title}>Principal</Text>
    </View>
    <View style={{ gap: theme.spacing[4] }}>
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </View>
  </View>
);

export const BeneficiariesLoading = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={overline}>Transferir</Text>
      <Text style={title}>¿A quién le envías?</Text>
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </View>
  </View>
);
