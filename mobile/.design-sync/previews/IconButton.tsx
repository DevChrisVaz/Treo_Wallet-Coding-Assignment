import { IconButton, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Botón solo con icono: 44 px y nombre accesible obligatorio (DSG-15).
const frame = { width: 390, padding: theme.spacing[5], gap: theme.spacing[4] };
const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing[3] };

export const Default = () => (
  <View style={frame}>
    <View style={row}>
      <IconButton icon="close" label="Salir de la transferencia" onPress={noop} />
      <IconButton icon="back" label="Atrás" onPress={noop} />
      <IconButton icon="logout" label="Cerrar sesión" onPress={noop} />
    </View>
  </View>
);

// `onDark` sobre la superficie de marca: icono blanco.
export const OnDark = () => (
  <View style={frame}>
    <View
      style={{
        ...row,
        padding: theme.spacing[3],
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface.hero,
      }}
    >
      <IconButton icon="close" label="Cerrar" tone="onDark" onPress={noop} />
      <IconButton icon="back" label="Atrás" tone="onDark" onPress={noop} />
    </View>
  </View>
);
