import { AmountField, Button, Select, TextField, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Ancho de teléfono, como el formulario de transferencia.
const frame = { width: 360, gap: theme.spacing[4], padding: theme.spacing[4] };

const accounts = [
  { value: 'principal', label: 'Principal', description: 'CLABE •••• 9719 · $25,000.00' },
  { value: 'ahorro', label: 'Ahorro', description: 'CLABE •••• 1234 · $10,000.00' },
];

export const Default = () => (
  <View style={frame}>
    <AmountField
      label="Monto"
      value=""
      placeholder="0.00"
      help="Hasta 2 decimales."
      onChangeText={noop}
    />
  </View>
);

export const Filled = () => (
  <View style={frame}>
    <AmountField
      label="Monto"
      value="1,250.50"
      help="Hasta 2 decimales."
      onChangeText={noop}
    />
  </View>
);

// MOB-08: se escribe con separadores de miles y punto decimal ("12,345.67"); a la API va "12345.67". Solo
// entran dígitos y un punto, con máximo 2 decimales. Diseño objetivo: el campo real aún no agrupa miles.
export const Formatted = () => (
  <View style={frame}>
    <AmountField label="Monto" value="12,345.67" help="Hasta 2 decimales." onChangeText={noop} />
  </View>
);

export const WithError = () => (
  <View style={frame}>
    <AmountField
      label="Monto"
      value="1,250.505"
      error="El monto admite máximo 2 decimales"
      onChangeText={noop}
    />
  </View>
);

// `hero`: el monto protagonista del paso de monto (MOB-21), grande, centrado y subrayado.
export const Hero = () => (
  <View style={{ ...frame, backgroundColor: theme.colors.surface.canvas }}>
    <AmountField
      variant="hero"
      label="Monto"
      value="1,250.00"
      help="Hasta 2 decimales."
      onChangeText={noop}
    />
  </View>
);

export const HeroLarge = () => (
  <View style={{ ...frame, backgroundColor: theme.colors.surface.canvas }}>
    <AmountField variant="hero" label="Monto" value="1,234,567.89" help="Hasta 2 decimales." onChangeText={noop} />
  </View>
);

export const Disabled = () => (
  <View style={frame}>
    <AmountField label="Monto" value="3,000.00" disabled onChangeText={noop} />
  </View>
);

export const TransferForm = () => (
  <View style={frame}>
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value="principal"
      onChange={noop}
    />
    <AmountField
      label="Monto"
      value="1,250.00"
      help="Hasta 2 decimales."
      onChangeText={noop}
    />
    <TextField label="Concepto" value="Renta" help="De 1 a 40 caracteres." onChangeText={noop} />
    <TextField
      label="Referencia (opcional)"
      value="1"
      help="Hasta 7 dígitos."
      maxLength={7}
      keyboardType="number-pad"
      onChangeText={noop}
    />
    <Button label="Continuar" onPress={noop} />
  </View>
);
