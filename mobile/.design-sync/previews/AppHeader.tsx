import { AppHeader, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
// El encabezado va sobre el fondo de la app, a todo el ancho del teléfono.
const frame = { width: 390, backgroundColor: theme.colors.surface.canvas };

// Inicio: sin título, saluda con el nombre. El avatar abre "Tu cuenta" (ver BottomSheet/AccountMenu).
export const Greeting = () => (
  <View style={frame}>
    <AppHeader user={user} onLogout={noop} />
  </View>
);

export const WithTitle = () => (
  <View style={frame}>
    <AppHeader user={user} title="Movimientos" onLogout={noop} />
  </View>
);

export const OtherUser = () => (
  <View style={frame}>
    <AppHeader user={{ name: 'Luis Pérez Ramírez', email: 'luis@example.com' }} onLogout={noop} />
  </View>
);
