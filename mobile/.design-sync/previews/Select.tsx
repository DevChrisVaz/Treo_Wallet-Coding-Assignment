import { AmountField, Select, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, gap: theme.spacing[4], padding: theme.spacing[4] };

// Cuentas propias como opciones: nombre, CLABE enmascarada y saldo.
const accounts = [
  { value: 'principal', label: 'Principal', description: 'CLABE •••• 9719 · $25,000.00' },
  { value: 'ahorro', label: 'Ahorro', description: 'CLABE •••• 1234 · $10,000.00' },
];

export const Placeholder = () => (
  <View style={frame}>
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value={undefined}
      onChange={noop}
    />
  </View>
);

export const Selected = () => (
  <View style={frame}>
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value="principal"
      onChange={noop}
    />
  </View>
);

export const WithError = () => (
  <View style={frame}>
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value={undefined}
      error="Elige la cuenta desde la que envías."
      onChange={noop}
    />
  </View>
);

export const InTransferForm = () => (
  <View style={frame}>
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={{ ...theme.typography.label, color: theme.colors.text.secondary }}>
        Transferir
      </Text>
      <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
        Captura los datos
      </Text>
      <Text style={{ ...theme.typography.bodySm, color: theme.colors.text.secondary }}>
        Para Luis · CLABE •••• 5678
      </Text>
    </View>
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value="ahorro"
      onChange={noop}
    />
    <AmountField
      label="Monto"
      value=""
      placeholder="0.00"
      help="Hasta 2 decimales, sin comas."
      onChangeText={noop}
    />
  </View>
);
