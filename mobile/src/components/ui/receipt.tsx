import { formatMXN, type Transfer } from '@devchrisvaz/wallet-contract';
import { toneIcon } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { formatDateTime, maskClabe, statusPresentation } from '@/lib/display';
import { theme } from '@/theme';

import { Avatar } from './avatar';
import { StatusBadge } from './status-badge';

interface ReceiptProps {
  /** Transferencia tal como la devolvió la API: el comprobante no usa lo capturado (MOB-13). */
  transfer: Transfer;
  fromAccountName?: string | undefined;
  /** CLABE de la cuenta de origen: con ella el origen lleva su terminación, como en la revisión. */
  fromAccountClabe?: string | undefined;
}

function Row({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable={selectable}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Comprobante: estado, monto, origen, destino, concepto, referencia, fecha y folio. Tarjeta blanca
 * con la elevación `card`, sin borde, como las demás superficies grandes (D4). El icono sigue el tono
 * del estado, como la insignia y como en la web: éxito, error (fallida o rechazada), aviso
 * (pendiente) o información (vencida).
 */
export function Receipt({ transfer, fromAccountName, fromAccountClabe }: ReceiptProps) {
  const { destination } = transfer;
  const completed = transfer.status === 'COMPLETED';
  const accountName = fromAccountName ?? 'Tu cuenta';
  const origin = fromAccountClabe ? `${accountName} · ${maskClabe(fromAccountClabe)}` : accountName;
  return (
    <View style={styles.card}>
      <View testID="receipt-avatar">
        <Avatar
          size="lg"
          tone={completed ? 'success' : 'neutral'}
          icon={toneIcon[statusPresentation(transfer.status).tone]}
        />
      </View>
      <StatusBadge status={transfer.status} />
      <Text style={styles.amount}>{formatMXN(transfer.amount)}</Text>
      <Row label="Origen" value={origin} />
      <Row
        label="Destino"
        value={`${destination.displayName} · ${maskClabe(destination.clabeLast4)}`}
      />
      <Row label="Concepto" value={transfer.concept} />
      {/* La referencia es opcional (MOB-13): sin ella la fila no se muestra (nunca "null"). */}
      {transfer.reference ? <Row label="Referencia" value={transfer.reference} /> : null}
      <Row
        label="Fecha"
        value={formatDateTime(transfer.completedAt ?? transfer.createdAt, { withYear: true })}
      />
      <Row label="Folio" value={transfer.id} selectable />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.default,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    gap: theme.spacing[3],
    ...theme.elevation.card,
  },
  amount: { ...theme.typography.display, ...theme.amount, color: theme.colors.text.primary },
  row: { gap: theme.spacing[1] },
  rowLabel: { ...theme.typography.caption, color: theme.colors.text.secondary },
  rowValue: { ...theme.typography.body, color: theme.colors.text.primary },
});
