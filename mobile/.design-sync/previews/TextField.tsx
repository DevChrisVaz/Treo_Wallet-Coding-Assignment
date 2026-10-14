import { TextField, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, gap: theme.spacing[4], padding: theme.spacing[4] };

export const Default = () => (
  <View style={frame}>
    <TextField
      label="Correo electrónico"
      variant="email"
      value=""
      placeholder="ana@example.com"
      onChangeText={noop}
    />
  </View>
);

export const WithHelp = () => (
  <View style={frame}>
    <TextField
      label="Concepto"
      value="Renta de octubre"
      help="Hasta 40 caracteres. Lo verá quien recibe la transferencia."
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
      error="Escribe de 1 a 7 dígitos."
      onChangeText={noop}
    />
  </View>
);

export const Disabled = () => (
  <View style={frame}>
    <TextField label="Cuenta de origen" value="Principal" disabled onChangeText={noop} />
  </View>
);

export const SignInForm = () => (
  <View style={frame}>
    <TextField
      label="Correo electrónico"
      variant="email"
      value="ana@example.com"
      onChangeText={noop}
    />
    <TextField
      label="Contraseña"
      variant="password"
      value="contraseña-segura"
      help="Al menos 12 caracteres."
      onChangeText={noop}
    />
  </View>
);
