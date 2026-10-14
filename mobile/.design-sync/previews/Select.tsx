import { AmountField, Avatar, ListSection, Select, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

// Lienzo de la app (surface.canvas) a ancho de teléfono, con el margen de pantalla.
const frame = {
  width: 390,
  gap: theme.spacing[5],
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};

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

// El paso del monto del flujo: el destinatario en su sección, el monto protagonista y la cuenta de
// origen (las mismas secciones que la pantalla, a 20 px).
export const InTransferForm = () => (
  <View style={frame}>
    <ListSection>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          minHeight: theme.touchTarget,
          paddingVertical: theme.spacing[3],
        }}
      >
        <Avatar initials="LP" />
        <View style={{ flex: 1, minWidth: 0, gap: theme.spacing[1] }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Para</Text>
          <Text style={{ ...theme.typography.label, color: theme.colors.text.primary }}>
            Luis · CLABE •••• 5678
          </Text>
        </View>
      </View>
    </ListSection>
    <AmountField
      variant="hero"
      label="Monto"
      value="1250.00"
      help="Hasta 2 decimales, sin comas."
      onChangeText={noop}
    />
    <Select
      label="Cuenta de origen"
      placeholder="Elige una cuenta"
      options={accounts}
      value="principal"
      onChange={noop}
    />
  </View>
);
