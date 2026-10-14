import { AccountCard, DailyLimitMeter, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Ancho de teléfono: las tarjetas ocupan el ancho de la pantalla de inicio.
const frame = { width: 360, padding: theme.spacing[4], gap: theme.spacing[3] };

export const Default = () => (
  <View style={frame}>
    <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" />
  </View>
);

export const Selected = () => (
  <View style={frame}>
    <AccountCard
      name="Principal"
      clabe="646180157000009719"
      balance="25000.00"
      selected
      onPress={noop}
    />
    <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={noop} />
  </View>
);

export const ZeroBalance = () => (
  <View style={frame}>
    <AccountCard name="Gastos del hogar" clabe="646180157000004410" balance="0.00" />
  </View>
);

export const LargeBalance = () => (
  <View style={frame}>
    <AccountCard name="Fondo de emergencia" clabe="646180157000007385" balance="1284937.50" />
  </View>
);

export const HomeAccountsList = () => (
  <View style={{ ...frame, gap: theme.spacing[4] }}>
    <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
    <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" onPress={noop} />
    <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={noop} />
    <Text
      style={{
        ...theme.typography.caption,
        color: theme.colors.text.muted,
        textAlign: 'center',
      }}
    >
      Toca una cuenta para ver sus últimos movimientos.
    </Text>
  </View>
);
