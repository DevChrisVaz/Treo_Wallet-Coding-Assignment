import { Button, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Ancho de teléfono: los botones de la app ocupan el ancho de la pantalla.
const frame = { width: 360, gap: theme.spacing[3], padding: theme.spacing[4] };

export const Variants = () => (
  <View style={frame}>
    <Button label="Continuar" onPress={noop} />
    <Button label="Ver movimientos" variant="secondary" onPress={noop} />
    <Button label="Cancelar" variant="ghost" onPress={noop} />
    <Button label="Eliminar beneficiario" variant="destructive" onPress={noop} />
  </View>
);

// Icono decorativo antes de la etiqueta (menú de la cuenta).
export const WithIcon = () => (
  <View style={frame}>
    <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={noop} />
    <Button label="Transferir" icon="transfer" onPress={noop} />
  </View>
);

export const Loading = () => (
  <View style={frame}>
    <Button label="Enviando…" loading onPress={noop} />
    <Button label="Reenviando código…" variant="secondary" loading onPress={noop} />
  </View>
);

export const Disabled = () => (
  <View style={frame}>
    <Button label="Transferir" disabled onPress={noop} />
    <Button label="Ver movimientos" variant="secondary" disabled onPress={noop} />
  </View>
);

export const FooterActions = () => (
  <View
    style={{
      ...frame,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.default,
    }}
  >
    <Button label="Confirmar transferencia" onPress={noop} />
    <Button label="Editar datos" variant="ghost" onPress={noop} />
  </View>
);
