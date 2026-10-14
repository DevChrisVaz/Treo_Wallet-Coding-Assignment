import {
  matchesBeneficiary,
  type Beneficiary,
  type BeneficiaryList,
} from '@devchrisvaz/wallet-contract';
import { useState } from 'react';
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
  TextField,
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
  /** Búsqueda con la que arranca la vista (lienzos); por omisión, vacía. */
  initialQuery?: string | undefined;
}

/**
 * Paso 1 del flujo (MOB-07, MOB-21): elegir un beneficiario ya registrado. La app no da de alta
 * beneficiarios: sin ninguno, indica registrarlos en la web. Con beneficiarios, un campo de búsqueda
 * filtra en el cliente por nombre, alias o CLABE (MOB-29); sin coincidencias ofrece limpiar la búsqueda.
 */
export function RecipientView({
  beneficiaries,
  onPick,
  onRetry,
  onClose,
  initialQuery = '',
}: RecipientViewProps) {
  const [query, setQuery] = useState(initialQuery);
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
        <SearchableBeneficiaries
          items={beneficiaries.data.items}
          query={query}
          onQueryChange={setQuery}
          onPick={onPick}
        />
      )}
    </Screen>
  );
}

/** Buscador y lista (MOB-29): el campo no aparece sin beneficiarios; la consulta vacía muestra todos. */
function SearchableBeneficiaries({
  items,
  query,
  onQueryChange,
  onPick,
}: {
  items: Beneficiary[];
  query: string;
  onQueryChange: (query: string) => void;
  onPick: (beneficiary: Beneficiary) => void;
}) {
  const shown = items.filter((beneficiary) => matchesBeneficiary(beneficiary, query));
  return (
    <>
      <TextField
        label="Buscar beneficiario"
        variant="search"
        placeholder="Buscar por nombre, alias o CLABE"
        value={query}
        onChangeText={onQueryChange}
      />
      {shown.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sin resultados"
          description={`No hay beneficiarios que coincidan con «${query.trim()}».`}
          action={{ label: 'Limpiar búsqueda', onPress: () => onQueryChange('') }}
        />
      ) : (
        <ListSection title="Beneficiarios">
          {shown.map((beneficiary, index) => (
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
    </>
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
