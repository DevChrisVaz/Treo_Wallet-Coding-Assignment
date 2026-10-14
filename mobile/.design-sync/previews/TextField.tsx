import { Text, TextField, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Lienzo de la app (surface.canvas) a ancho de teléfono, con el margen de pantalla.
const frame = {
  width: 390,
  gap: theme.spacing[5],
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

export const Default = () => (
  <View style={frame}>
    <TextField
      label="Correo"
      variant="email"
      value=""
      placeholder="ana@example.com"
      onChangeText={noop}
    />
  </View>
);

// Las ayudas del paso del monto (las mismas en la web, R30).
export const WithHelp = () => (
  <View style={frame}>
    <TextField
      label="Concepto"
      value="Renta"
      help="De 1 a 40 caracteres."
      maxLength={40}
      onChangeText={noop}
    />
  </View>
);

export const WithError = () => (
  <View style={frame}>
    <TextField
      label="Referencia"
      value="12A"
      keyboardType="number-pad"
      help="De 1 a 7 dígitos."
      error="La referencia solo admite dígitos"
      onChangeText={noop}
    />
  </View>
);

export const Disabled = () => (
  <View style={frame}>
    <TextField label="Cuenta de origen" value="Principal" disabled onChangeText={noop} />
  </View>
);

// Inicio de sesión, en la hoja blanca que BrandScreen pone sobre la superficie de marca.
export const SignInForm = () => (
  <View style={{ width: 390, backgroundColor: theme.colors.surface.hero, paddingTop: theme.spacing[8] }}>
    <View
      style={{
        gap: theme.spacing[6],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[8],
        paddingBottom: theme.spacing[10],
        backgroundColor: theme.colors.surface.default,
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
      }}
    >
      <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Inicia sesión</Text>
      <TextField label="Correo" variant="email" value="ana@example.com" onChangeText={noop} />
      <TextField
        label="Contraseña"
        variant="password"
        value="contraseña-segura"
        onChangeText={noop}
      />
    </View>
  </View>
);
