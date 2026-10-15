import { ICONS, Icon, Text, View, theme } from 'wallet-mobile-ui';

// Iconos de línea de Lucide por concepto (DSG-15): se pide el concepto, no el icono.
const frame = { width: 390, padding: theme.spacing[5], gap: theme.spacing[4] };
const caption = { ...theme.typography.caption, color: theme.colors.text.secondary };

const MEANING: Record<keyof typeof ICONS, string> = {
  home: 'Inicio',
  movements: 'Movimientos',
  transfer: 'Transferir',
  beneficiaries: 'Beneficiarios',
  logout: 'Cerrar sesión',
  moneyIn: 'Entrada',
  moneyOut: 'Salida',
  deposit: 'Depósito',
  ownTransfer: 'Traspaso propio',
  success: 'Éxito',
  error: 'Error',
  warning: 'Aviso',
  info: 'Información',
  close: 'Cerrar',
  back: 'Atrás',
  forward: 'Siguiente',
  expand: 'Desplegar',
  filter: 'Filtrar',
  account: 'Cuenta',
};

export const Concepts = () => (
  <View style={{ ...frame, flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
    {(Object.keys(MEANING) as (keyof typeof ICONS)[]).map((name) => (
      <View
        key={name}
        style={{ width: '33.33%', alignItems: 'center', gap: theme.spacing[1], paddingVertical: theme.spacing[3] }}
      >
        <Icon name={name} color={theme.colors.text.primary} />
        <Text style={{ ...theme.typography.label, color: theme.colors.text.primary }}>{name}</Text>
        <Text style={caption}>{MEANING[name]}</Text>
      </View>
    ))}
  </View>
);

export const Sizes = () => (
  <View style={{ ...frame, flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[6] }}>
    {(['sm', 'md', 'lg'] as const).map((size) => (
      <View key={size} style={{ alignItems: 'center', gap: theme.spacing[2] }}>
        <Icon name="transfer" size={size} color={theme.colors.text.primary} />
        <Text style={caption}>{`${size} · ${{ sm: 16, md: 20, lg: 24 }[size]}`}</Text>
      </View>
    ))}
  </View>
);

// Sobre superficies oscuras el icono va en lima (`accent.onDark`), nunca sobre claras.
export const OnDark = () => (
  <View style={frame}>
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing[6],
        padding: theme.spacing[5],
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface.hero,
      }}
    >
      <Icon name="home" size="lg" color={theme.colors.accent.onDark} />
      <Icon name="transfer" size="lg" color={theme.colors.accent.onDark} />
      <Icon name="movements" size="lg" color={theme.colors.accent.onDark} />
      <Icon name="close" size="lg" color={theme.colors.text.onInverse} />
    </View>
  </View>
);

// Glifos propios de la app (DSG-15), fuera del mapa compartido de conceptos: buscar, recibir dinero
// (flecha entrante), copiar y compartir.
export const AppGlyphs = () => (
  <View style={{ ...frame, flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
    {(['search', 'receive', 'copy', 'share'] as const).map((name) => (
      <View
        key={name}
        style={{ width: '25%', alignItems: 'center', gap: theme.spacing[1], paddingVertical: theme.spacing[3] }}
      >
        <Icon name={name} color={theme.colors.text.primary} />
        <Text style={{ ...theme.typography.label, color: theme.colors.text.primary }}>{name}</Text>
      </View>
    ))}
  </View>
);
