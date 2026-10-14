import type { Beneficiary, BeneficiaryList } from '@devchrisvaz/wallet-contract';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  Avatar,
  Button,
  EmptyState,
  FlowHeader,
  Icon,
  InlineAlert,
  ListSection,
  Skeleton,
  initials,
} from '@/components/ui';
import { maskClabe } from '@/lib/display';
import type { Loadable } from '@/lib/loadable';
import { theme } from '@/theme';

import { RECIPIENT_HEADING } from './flow-steps';

export interface RecipientViewProps {
  beneficiaries: Loadable<BeneficiaryList>;
  onPick: (beneficiary: Beneficiary) => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Paso 1 del flujo (MOB-07, MOB-21): elegir un beneficiario ya registrado. La app no da de alta
 * beneficiarios: sin ninguno, indica registrarlos en la web.
 */
export function RecipientView({ beneficiaries, onPick, onRetry, onClose }: RecipientViewProps) {
  return (
    <Screen
      header={
        <FlowHeader
          title={RECIPIENT_HEADING.title}
          step={RECIPIENT_HEADING.step}
          total={RECIPIENT_HEADING.total}
          stepLabel={RECIPIENT_HEADING.label}
          onClose={onClose}
        />
      }
    >
      {beneficiaries.status === 'pending' ? (
        <View style={styles.stack}>
          <Skeleton variant="line" />
          <Skeleton variant="line" />
          <Skeleton variant="line" />
        </View>
      ) : beneficiaries.status === 'error' ? (
        <View style={styles.stack}>
          <InlineAlert
            tone="danger"
            title="No pudimos cargar tus beneficiarios"
            message={beneficiaries.message}
          />
          <Button label="Reintentar" variant="secondary" onPress={onRetry} />
        </View>
      ) : beneficiaries.data.items.length === 0 ? (
        <EmptyState
          icon="beneficiaries"
          title="Aún no tienes beneficiarios"
          description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí."
        />
      ) : (
        <ListSection title="Beneficiarios">
          {beneficiaries.data.items.map((beneficiary, index) => (
            <Pressable
              key={beneficiary.id}
              accessibilityRole="button"
              accessibilityLabel={`${beneficiary.alias}, ${beneficiary.name}, CLABE terminación ${beneficiary.clabe.slice(-4)}`}
              onPress={() => onPick(beneficiary)}
              style={[styles.row, index === 0 ? null : styles.divider]}
            >
              <Avatar initials={initials(beneficiary.name)} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{beneficiary.alias}</Text>
                <Text style={styles.rowDetail} numberOfLines={1}>
                  {`${beneficiary.name} · CLABE ${maskClabe(beneficiary.clabe)}`}
                </Text>
              </View>
              <Icon name="forward" color={theme.colors.text.muted} />
            </Pressable>
          ))}
        </ListSection>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing[4] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: theme.touchTarget,
    paddingVertical: theme.spacing[3],
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  rowText: { flex: 1, minWidth: 0, gap: theme.spacing[1] },
  rowTitle: { ...theme.typography.label, color: theme.colors.text.primary },
  rowDetail: { ...theme.typography.caption, color: theme.colors.text.secondary },
});
