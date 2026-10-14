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
      label="Referencia (opcional)"
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

// MOB-08: la referencia es opcional y solo admite dígitos (máximo 7).
export const OptionalReference = () => (
  <View style={frame}>
    <TextField
      label="Referencia (opcional)"
      value=""
      help="Hasta 7 dígitos."
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={7}
      onChangeText={noop}
    />
  </View>
);

// MOB-29: búsqueda con lupa al inicio y × cuando hay texto. La etiqueta es solo el nombre accesible.
export const Search = () => (
  <View style={frame}>
    <TextField
      label="Buscar beneficiario"
      variant="search"
      placeholder="Buscar por nombre, alias o CLABE"
      value=""
      onChangeText={noop}
    />
  </View>
);

export const SearchFilled = () => (
  <View style={frame}>
    <TextField
      label="Buscar beneficiario"
      variant="search"
      placeholder="Buscar por nombre, alias o CLABE"
      value="Luis"
      onChangeText={noop}
    />
  </View>
);
