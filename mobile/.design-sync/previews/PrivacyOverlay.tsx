import { AccountCard, DailyLimitMeter, PrivacyOverlay, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// La capa se pinta en `absoluteFill`: necesita un contenedor con tamaño de pantalla.
const phone = {
  width: 360,
  height: 640,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  backgroundColor: theme.colors.surface.default,
};

export const Default = () => (
  <View style={phone}>
    <PrivacyOverlay />
  </View>
);

const HomeContent = () => (
  <View style={{ padding: theme.spacing[5], gap: theme.spacing[5] }}>
    <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Tus cuentas</Text>
    <View style={{ gap: theme.spacing[4] }}>
      <DailyLimitMeter dailyLimit={{ limit: '50000.00', used: '18500.00', remaining: '31500.00' }} />
      <AccountCard name="Principal" clabe="646180157000009719" balance="25000.00" onPress={noop} />
      <AccountCard name="Ahorro" clabe="646180157000001234" balance="10000.00" onPress={noop} />
    </View>
  </View>
);

const stateLabel = { ...theme.typography.caption, color: theme.colors.text.muted };

const miniPhone = {
  ...phone,
  width: 300,
  height: 540,
  borderWidth: 1,
  borderColor: theme.colors.border.default,
  borderRadius: theme.radius.lg,
};

// La misma pantalla de inicio activa y en el selector de apps: en segundo plano, los saldos quedan tapados.
export const AppSwitcherStates = () => (
  <View style={{ flexDirection: 'row', gap: theme.spacing[4], padding: theme.spacing[4] }}>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={stateLabel}>Activa</Text>
      <View style={miniPhone}>
        <HomeContent />
      </View>
    </View>
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={stateLabel}>En segundo plano</Text>
      <View style={miniPhone}>
        <HomeContent />
        <PrivacyOverlay />
      </View>
    </View>
  </View>
);

export const SmallPhone = () => (
  <View style={{ ...phone, width: 320, height: 568 }}>
    <PrivacyOverlay />
  </View>
);
