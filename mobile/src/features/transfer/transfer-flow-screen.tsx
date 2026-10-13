import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, InlineAlert, Skeleton } from '@/components/ui';
import { useAccountsOverview, useBeneficiaries } from '@/features/accounts/queries';
import { maskClabe } from '@/lib/display';
import { errorMessage } from '@/lib/errors';
import { theme } from '@/theme';

import { FormView, type FormValues } from './form-view';
import { ReviewView } from './review-view';
import { useTransferAttempt } from './use-transfer-attempt';

/**
 * Flujo de una transferencia a un beneficiario registrado. Lo que se muestra sale del estado de
 * `TransferAttempt`: captura, confirmación, envío y resultado.
 */
export function TransferFlowScreen() {
  const router = useRouter();
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId: string }>();
  const accounts = useAccountsOverview();
  const beneficiaries = useBeneficiaries();
  const beneficiary = beneficiaries.data?.items.find((item) => item.id === beneficiaryId);
  const { attempt, state } = useTransferAttempt();

  const [values, setValues] = useState<FormValues>({
    fromAccountId: undefined,
    amount: '',
    concept: '',
    reference: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const accountList = accounts.data?.accounts ?? [];
  const fromAccountId = values.fromAccountId ?? accountList[0]?.id;

  function onContinue() {
    const result = attempt.review({
      fromAccountId: fromAccountId ?? '',
      beneficiaryId,
      amount: values.amount,
      concept: values.concept,
      reference: values.reference,
    });
    setErrors(result.ok ? {} : result.errors);
  }

  const loadError = accounts.error ?? beneficiaries.error;

  return (
    <Screen footer={<Button label="Cancelar" variant="ghost" onPress={() => router.back()} />}>
      <View style={styles.header}>
        <Text style={styles.overline}>Transferir</Text>
        <Text style={styles.title} accessibilityRole="header">
          {state.status === 'editing' ? '¿Cuánto envías?' : 'Revisa tu transferencia'}
        </Text>
        {beneficiary ? (
          <Text style={styles.subtitle}>
            {`Para ${beneficiary.alias} · CLABE ${maskClabe(beneficiary.clabe)}`}
          </Text>
        ) : null}
      </View>

      {accounts.isPending || beneficiaries.isPending ? (
        <View style={styles.loading}>
          <Skeleton variant="line" />
          <Skeleton variant="line" />
        </View>
      ) : loadError ? (
        <InlineAlert tone="danger" message={errorMessage(loadError)} />
      ) : state.status === 'editing' ? (
        <FormView
          accounts={accountList}
          values={{ ...values, fromAccountId }}
          errors={errors}
          onChange={setValues}
          onContinue={onContinue}
        />
      ) : 'draft' in state ? (
        <ReviewView
          draft={state.draft}
          account={accountList.find((account) => account.id === state.draft.fromAccountId)}
          beneficiary={beneficiary}
          sending={state.status === 'sending' || state.status === 'waitingRetry'}
          onSend={() => void attempt.submit()}
          onEdit={() => attempt.edit()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[1] },
  overline: { ...theme.typography.label, color: theme.colors.text.secondary },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
  subtitle: { ...theme.typography.body, color: theme.colors.text.secondary },
  loading: { gap: theme.spacing[4] },
});
