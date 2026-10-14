import { EmptyState, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, padding: theme.spacing[4], gap: theme.spacing[3] };

export const NoMovements = () => (
  <View style={frame}>
    <EmptyState
      title="Aún no hay movimientos"
      description="Aquí verás los depósitos y las transferencias de esta cuenta."
    />
  </View>
);

export const WithAction = () => (
  <View style={frame}>
    <EmptyState
      title="Sin movimientos"
      description="Aquí verás tus depósitos y transferencias."
      action={{ label: 'Actualizar', onPress: noop }}
    />
  </View>
);

export const NoAccounts = () => (
  <View style={frame}>
    <EmptyState
      title="Aún no tienes cuentas"
      description="Cuando tu cuenta esté lista, aquí verás su saldo."
    />
  </View>
);

export const NoBeneficiaries = () => (
  <View style={frame}>
    <EmptyState
      title="Aún no tienes beneficiarios"
      description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí."
    />
  </View>
);

export const InMovementsScreen = () => (
  <View style={{ ...frame, gap: theme.spacing[5] }}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={{ ...theme.typography.label, color: theme.colors.text.secondary }}>
        Últimos movimientos
      </Text>
      <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Ahorro</Text>
    </View>
    <EmptyState
      title="Aún no hay movimientos"
      description="Aquí verás los depósitos y las transferencias de esta cuenta."
    />
  </View>
);
