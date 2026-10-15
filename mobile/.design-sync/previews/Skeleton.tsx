import { ListSection, Skeleton, View, theme } from 'wallet-mobile-ui';

// Lienzo de la app (surface.canvas) a ancho de teléfono, con el margen de pantalla. Las líneas van
// dentro de la sección de la lista que reemplazan; la tarjeta ocupa el lugar de una AccountCard y,
// mientras Inicio carga, el del hero.
const frame = {
  width: 390,
  gap: theme.spacing[5],
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};
const stack = { gap: theme.spacing[3] };

export const Line = () => (
  <View style={frame}>
    <ListSection>
      <View style={stack}>
        <Skeleton variant="line" />
        <Skeleton variant="line" />
        <Skeleton variant="line" />
      </View>
    </ListSection>
  </View>
);

export const Card = () => (
  <View style={frame}>
    <Skeleton variant="card" />
  </View>
);

// Inicio cargando: el hero, las dos tarjetas y los últimos movimientos.
export const HomeLoading = () => (
  <View style={frame}>
    <Skeleton variant="card" />
    <View style={stack}>
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </View>
    <ListSection>
      <View style={stack}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </View>
    </ListSection>
  </View>
);

// "Últimos movimientos" de Inicio mientras carga la cuenta elegida.
export const MovementsLoading = () => (
  <View style={frame}>
    <ListSection title="Últimos movimientos">
      <View style={stack}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </View>
    </ListSection>
  </View>
);

// El paso del destinatario mientras cargan los beneficiarios.
export const BeneficiariesLoading = () => (
  <View style={frame}>
    <View style={stack}>
      <Skeleton variant="line" />
      <Skeleton variant="line" />
      <Skeleton variant="line" />
    </View>
  </View>
);
