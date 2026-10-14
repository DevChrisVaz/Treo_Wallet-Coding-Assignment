import { BalanceHero, QuickActions, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Con el margen de pantalla sobre el fondo de la app: el ancho real del hero en Inicio (MOB-19).
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

// Principal ($25,000.00) + Ahorro ($10,000.00), y lo que queda del límite de $50,000.00.
export const Default = () => (
  <View style={frame}>
    <BalanceHero total="35000.00" available="31500.00" />
  </View>
);

export const WithActions = () => (
  <View style={frame}>
    <BalanceHero
      total="35000.00"
      available="31500.00"
      actions={
        <QuickActions
          actions={[
            { key: 'transfer', label: 'Transferir', icon: 'transfer', onPress: noop },
            { key: 'movements', label: 'Movimientos', icon: 'movements', onPress: noop },
          ]}
        />
      }
    />
  </View>
);

// Saldo muy grande: baja de tamaño para quedar en una línea a 390 px (heroAmountSize).
export const LargeBalance = () => (
  <View style={frame}>
    <BalanceHero total="1234567890.00" available="50000.00" />
  </View>
);

// Sin cuentas todavía: total en cero y el límite completo disponible.
export const ZeroBalance = () => (
  <View style={frame}>
    <BalanceHero total="0.00" available="50000.00" />
  </View>
);
