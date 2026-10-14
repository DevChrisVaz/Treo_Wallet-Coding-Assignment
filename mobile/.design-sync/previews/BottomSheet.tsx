/*
 * La hoja es un `Modal` de React Native: en el navegador cubre toda la ventana, así que la tarjeta
 * va en modo `single` con una ventana de 390x520 (config.json) y cada historia pone detrás la
 * pantalla desde la que se abre. El contenido copia el de AppHeader ("Tu cuenta") y el de Select.
 */
import {
  AppHeader,
  Avatar,
  BalanceHero,
  BottomSheet,
  Button,
  FlowHeader,
  OptionRow,
  Text,
  UnlockSwitchView,
  View,
  initials,
  theme,
} from 'wallet-mobile-ui';

const noop = () => {};

const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const screen = { width: 390, height: 520, backgroundColor: theme.colors.surface.canvas };
const content = { paddingHorizontal: theme.spacing[5], gap: theme.spacing[5] };

// La persona de la sesión, arriba del menú (como en AppHeader).
const identity = (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
    <Avatar tone="brand" initials={initials(user.name)} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...theme.typography.label, color: theme.colors.text.primary }}>
        {user.name}
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {user.email}
      </Text>
    </View>
  </View>
);

// El menú del avatar en Inicio, con "Cerrar sesión" (MOB-18).
export const AccountMenu = () => (
  <View style={screen}>
    <AppHeader user={user} onLogout={noop} />
    <View style={content}>
      <BalanceHero total="35000.00" available="31500.00" />
    </View>
    <BottomSheet open onClose={noop} title="Tu cuenta">
      {identity}
      <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={noop} />
    </BottomSheet>
  </View>
);

// Bonus (MOB-24, MOB-27; R46): el interruptor del desbloqueo va en el menú, antes de "Cerrar sesión".
// Es la vista real del interruptor (features/unlock/unlock-switch-view.tsx), encendido.
export const AccountMenuUnlock = () => (
  <View style={screen}>
    <AppHeader user={user} onLogout={noop} />
    <View style={content}>
      <BalanceHero total="35000.00" available="31500.00" />
    </View>
    <BottomSheet open onClose={noop} title="Tu cuenta">
      {identity}
      <UnlockSwitchView kind="huella" available enabled busy={false} onChange={noop} />
      <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={noop} />
    </BottomSheet>
  </View>
);

// Sin biometría registrada (MOB-24): el interruptor deshabilitado, con lo que hay que registrar.
export const AccountMenuUnlockUnavailable = () => (
  <View style={screen}>
    <AppHeader user={user} onLogout={noop} />
    <View style={content}>
      <BalanceHero total="35000.00" available="31500.00" />
    </View>
    <BottomSheet open onClose={noop} title="Tu cuenta">
      {identity}
      <UnlockSwitchView
        kind="huella"
        available={false}
        enabled={false}
        busy={false}
        onChange={noop}
      />
      <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={noop} />
    </BottomSheet>
  </View>
);

// La lista de "Cuenta de origen" que abre Select en el paso de monto.
export const SourceAccount = () => (
  <View style={screen}>
    <FlowHeader title="¿Cuánto envías?" step={2} total={5} stepLabel="Monto" onClose={noop} />
    <BottomSheet open onClose={noop} title="Cuenta de origen">
      <OptionRow
        option={{ value: 'principal', label: 'Principal', description: 'CLABE •••• 9719 · $25,000.00' }}
        selected
        onPress={noop}
      />
      <OptionRow
        option={{ value: 'ahorro', label: 'Ahorro', description: 'CLABE •••• 1234 · $10,000.00' }}
        onPress={noop}
      />
    </BottomSheet>
  </View>
);
