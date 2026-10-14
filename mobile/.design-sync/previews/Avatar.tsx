import type { ReactNode } from 'react';
import { Avatar, Text, View, initials, theme } from 'wallet-mobile-ui';

// Círculos decorativos: iniciales del usuario o de un beneficiario, o el icono de un movimiento.
const frame = { width: 390, padding: theme.spacing[5], gap: theme.spacing[4] };
const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing[4] };
const caption = { ...theme.typography.caption, color: theme.colors.text.secondary };

const item = (node: ReactNode, text: string) => (
  <View key={text} style={{ alignItems: 'center', gap: theme.spacing[2] }}>
    {node}
    <Text style={caption}>{text}</Text>
  </View>
);

export const Sizes = () => (
  <View style={frame}>
    <View style={row}>
      {item(<Avatar size="sm" initials={initials('Ana Gómez Castillo')} />, 'sm · 32')}
      {item(<Avatar size="md" initials={initials('Ana Gómez Castillo')} />, 'md · 40')}
      {item(<Avatar size="lg" initials={initials('Ana Gómez Castillo')} />, 'lg · 56')}
    </View>
  </View>
);

// `hero` es el del menú de la cuenta (lima sobre verde profundo); `brand`, el de los beneficiarios.
export const Tones = () => (
  <View style={frame}>
    <View style={row}>
      {item(<Avatar tone="hero" initials="AG" />, 'hero')}
      {item(<Avatar tone="brand" initials="LP" />, 'brand')}
      {item(<Avatar tone="success" icon="moneyIn" />, 'success')}
      {item(<Avatar tone="neutral" icon="moneyOut" />, 'neutral')}
    </View>
  </View>
);

// Un icono por tipo de movimiento: verde suave las entradas, neutro las salidas.
export const MovementTypes = () => (
  <View style={frame}>
    <View style={row}>
      {item(<Avatar tone="success" icon="moneyIn" />, 'Recibida')}
      {item(<Avatar tone="neutral" icon="moneyOut" />, 'Enviada')}
      {item(<Avatar tone="success" icon="deposit" />, 'Depósito')}
      {item(<Avatar tone="neutral" icon="ownTransfer" />, 'Traspaso')}
    </View>
  </View>
);

// Estados vacíos y comprobante usan el tamaño grande con icono.
export const LargeIcons = () => (
  <View style={frame}>
    <View style={row}>
      {item(<Avatar size="lg" icon="account" />, 'Sin cuentas')}
      {item(<Avatar size="lg" icon="beneficiaries" />, 'Sin beneficiarios')}
      {item(<Avatar size="lg" tone="success" icon="success" />, 'Completada')}
    </View>
  </View>
);
