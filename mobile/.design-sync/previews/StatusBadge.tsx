import { ListSection, StatusBadge, View, theme } from 'wallet-mobile-ui';

// Lienzo de la app a ancho de teléfono. En las pantallas rediseñadas la insignia va dentro del
// comprobante (Receipt), sobre blanco: aquí, en una ListSection. El fondo neutro (Vencida,
// Cancelada) es el color del lienzo, así que sobre él no se vería la píldora. Siempre lleva su
// etiqueta: el color no es la única señal.
const frame = {
  width: 390,
  padding: theme.spacing[5],
  backgroundColor: theme.colors.surface.canvas,
};
const stack = { gap: theme.spacing[3], alignItems: 'flex-start' as const };

export const AllStatuses = () => (
  <View style={frame}>
    <ListSection>
      <View style={stack}>
        <StatusBadge status="COMPLETED" />
        <StatusBadge status="PENDING_OTP" />
        <StatusBadge status="REJECTED" />
        <StatusBadge status="FAILED" />
        <StatusBadge status="EXPIRED" />
        {/* Bonus (MOB-23): programada (informativo) y cancelada (neutro). */}
        <StatusBadge status="SCHEDULED" />
        <StatusBadge status="CANCELLED" />
      </View>
    </ListSection>
  </View>
);

export const Completed = () => (
  <View style={frame}>
    <ListSection>
      <View style={stack}>
        <StatusBadge status="COMPLETED" />
      </View>
    </ListSection>
  </View>
);
