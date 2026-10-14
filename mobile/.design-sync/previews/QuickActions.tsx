import { BalanceHero, QuickActions, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Las acciones van sobre el verde del hero: texto blanco e icono lima solo sobre oscuro (DSG-14).
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};
const hero = {
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.surface.hero,
  padding: theme.spacing[6],
};

const actions = [
  { key: 'transfer', label: 'Transferir', icon: 'transfer' as const, onPress: noop },
  { key: 'movements', label: 'Movimientos', icon: 'movements' as const, onPress: noop },
];

export const Home = () => (
  <View style={frame}>
    <View style={hero}>
      <QuickActions actions={actions} />
    </View>
  </View>
);

// Como se usan en Inicio: debajo del saldo total y del chip del límite disponible.
export const InBalanceHero = () => (
  <View style={frame}>
    <BalanceHero total="35000.00" available="31500.00" actions={<QuickActions actions={actions} />} />
  </View>
);

// MOB-28: Inicio gana "Recibir" (flecha entrante) después de "Transferir".
const withReceive = [
  actions[0],
  { key: 'receive', label: 'Recibir', icon: 'receive' as const, onPress: noop },
  actions[1],
];

export const WithReceive = () => (
  <View style={frame}>
    <BalanceHero total="35000.00" available="31500.00" actions={<QuickActions actions={withReceive} />} />
  </View>
);
