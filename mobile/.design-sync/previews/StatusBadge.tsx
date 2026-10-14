import { Button, InlineAlert, StatusBadge, Text, View, theme } from 'wallet-mobile-ui';

const noop = () => {};

const frame = { width: 360, gap: theme.spacing[4], padding: theme.spacing[4] };

const caption = { ...theme.typography.caption, color: theme.colors.text.secondary };

export const AllStatuses = () => (
  <View style={{ ...frame, gap: theme.spacing[3] }}>
    <StatusBadge status="COMPLETED" />
    <StatusBadge status="PENDING_OTP" />
    <StatusBadge status="REJECTED" />
    <StatusBadge status="FAILED" />
    <StatusBadge status="EXPIRED" />
    {/* Bonus (MOB-23): programada (informativo) y cancelada (neutro). */}
    <StatusBadge status="SCHEDULED" />
    <StatusBadge status="CANCELLED" />
  </View>
);

export const FailedOutcome = () => (
  <View style={frame}>
    <StatusBadge status="FAILED" />
    <InlineAlert
      tone="danger"
      message="Algo falló de nuestro lado. Intenta de nuevo en unos minutos."
    />
    <Button label="Intentar de nuevo" onPress={noop} />
    <Button label="Ir a mis cuentas" variant="secondary" onPress={noop} />
  </View>
);

export const ExpiredOutcome = () => (
  <View style={frame}>
    <StatusBadge status="EXPIRED" />
    <InlineAlert tone="danger" message="El código venció. Crea la transferencia de nuevo." />
    <Button label="Intentar de nuevo" onPress={noop} />
    <Button label="Ir a mis cuentas" variant="secondary" onPress={noop} />
  </View>
);

export const TransferSummary = () => (
  <View style={frame}>
    <View
      style={{
        gap: theme.spacing[3],
        padding: theme.spacing[5],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
      }}
    >
      <StatusBadge status="PENDING_OTP" />
      <Text style={{ ...theme.typography.h2, ...theme.amount, color: theme.colors.text.primary }}>
        $12,500.00
      </Text>
      <View style={{ gap: theme.spacing[1] }}>
        <Text style={caption}>Para</Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
          Mamá · •••• 4321
        </Text>
      </View>
      <View style={{ gap: theme.spacing[1] }}>
        <Text style={caption}>Concepto</Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
          Colegiatura
        </Text>
      </View>
    </View>
  </View>
);
