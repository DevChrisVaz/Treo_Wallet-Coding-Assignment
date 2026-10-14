import { TabBar, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Las pestañas de la app (MOB-18): Inicio, Movimientos y Transferir, a todo el ancho del teléfono.
const tabs = ['home', 'movements', 'transfer'] as const;
const frame = { width: 390, paddingTop: theme.spacing[6], backgroundColor: theme.colors.surface.canvas };

export const Home = () => (
  <View style={frame}>
    <TabBar items={tabs} current="home" onSelect={noop} />
  </View>
);

export const Movements = () => (
  <View style={frame}>
    <TabBar items={tabs} current="movements" onSelect={noop} />
  </View>
);

// Sin pestaña marcada: una pantalla fuera de las pestañas (el detalle de una transferencia).
export const NoneSelected = () => (
  <View style={frame}>
    <TabBar items={tabs} current={null} onSelect={noop} />
  </View>
);
