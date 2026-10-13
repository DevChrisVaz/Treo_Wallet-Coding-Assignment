import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, EmptyState, InlineAlert, OptionRow, Skeleton } from '@/components/ui';
import { useBeneficiaries } from '@/features/accounts/queries';
import { maskClabe } from '@/lib/display';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

/**
 * Elegir un beneficiario ya registrado (MOB-07). La app no da de alta beneficiarios: sin ninguno,
 * indica registrarlos en la web.
 */
export function BeneficiaryPickerScreen() {
  const router = useRouter();
  const beneficiaries = useBeneficiaries();

  return (
    <Screen footer={<Button label="Cancelar" variant="ghost" onPress={() => router.back()} />}>
      <View style={styles.header}>
        <Text style={styles.overline}>Transferir</Text>
        <Text style={styles.title} accessibilityRole="header">
          ¿A quién le envías?
        </Text>
      </View>

      {beneficiaries.isPending ? (
        <View style={styles.list}>
          <Skeleton variant="line" />
          <Skeleton variant="line" />
          <Skeleton variant="line" />
        </View>
      ) : beneficiaries.isError ? (
        <View style={styles.list}>
          <InlineAlert tone="danger" message={errorMessage(beneficiaries.error)} />
          <Button
            label="Reintentar"
            variant="secondary"
            onPress={() => void beneficiaries.refetch()}
          />
        </View>
      ) : beneficiaries.data.items.length === 0 ? (
        <EmptyState
          title="Aún no tienes beneficiarios"
          description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí."
        />
      ) : (
        <View style={styles.list}>
          {beneficiaries.data.items.map((beneficiary) => (
            <OptionRow
              key={beneficiary.id}
              option={{
                value: beneficiary.id,
                label: beneficiary.alias,
                description: `${beneficiary.name} · CLABE ${maskClabe(beneficiary.clabe)}`,
              }}
              onPress={() =>
                router.push({
                  pathname: '/transfer/send',
                  params: { beneficiaryId: beneficiary.id },
                })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[1] },
  overline: { ...theme.typography.label, color: theme.colors.text.secondary },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  list: { gap: theme.spacing[2] },
});
