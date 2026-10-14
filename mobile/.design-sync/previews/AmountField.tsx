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
      help="Hasta 2 decimales, sin comas."
      onChangeText={noop}
    />
  </View>
);

export const Filled = () => (
  <View style={frame}>
    <AmountField
      label="Monto"
      value="1250.50"
      help="Hasta 2 decimales, sin comas."
      onChangeText={noop}
    />
  </View>
);

export const WithError = () => (
  <View style={frame}>
    <AmountField
      label="Monto"
      value="1250.505"
      error="El monto admite máximo 2 decimales"
      onChangeText={noop}
    />
  </View>
);

export const Disabled = () => (
  <View style={frame}>
    <AmountField label="Monto" value="3000.00" disabled onChangeText={noop} />
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
      value="1250.00"
      help="Hasta 2 decimales, sin comas."
      onChangeText={noop}
    />
    <TextField label="Concepto" value="Renta" help="De 1 a 40 caracteres." onChangeText={noop} />
    <TextField
      label="Referencia"
      value="1"
      help="De 1 a 7 dígitos."
      keyboardType="number-pad"
      onChangeText={noop}
    />
    <Button label="Continuar" onPress={noop} />
  </View>
);
