import { AccountCard, DailyLimitMeter, ListSection, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Lienzo de la app (surface.canvas) a ancho de teléfono, con el margen de pantalla; las tarjetas
// van apiladas a 12 px, como en Inicio.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  gap: theme.spacing[3],
  backgroundColor: theme.colors.surface.canvas,
};

export const Default = () => (
  <View style={frame}>
    <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" />
  </View>
);

// Inicio: las tarjetas son el selector de la cuenta; la elegida lleva el borde de 2 px.
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
    <AccountCard name="Ahorro" clabe="646180157000001234" balance="0.00" />
  </View>
);

export const LargeBalance = () => (
  <View style={frame}>
    <AccountCard name="Principal" clabe="646180157000009719" balance="1284937.50" />
  </View>
);

// Inicio, debajo del hero: las cuentas y, en su sección, el límite diario.
export const HomeAccounts = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[3] }}>
      <AccountCard
        name="Principal"
        clabe="646180157000009719"
        balance="25000.00"
        selected
        onPress={noop}
      />
      <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={noop} />
    </View>
    <ListSection>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
    </ListSection>
  </View>
);
