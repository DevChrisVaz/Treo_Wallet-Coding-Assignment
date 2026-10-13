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
import { AttemptActions } from './attempt-actions';
import { OtpView } from './otp-view';
import { OutcomeView } from './outcome-view';
import { ReviewView } from './review-view';
import type { AttemptState } from './transfer-attempt';
import { useTransferAttempt } from './use-transfer-attempt';

const TITLES: Record<AttemptState['status'], string> = {
  editing: '¿Cuánto envías?',
  reviewing: 'Revisa tu transferencia',
  sending: 'Enviando tu transferencia',
  waitingRetry: 'Enviando tu transferencia',
  rateLimited: 'Espera un momento',
  uncertain: 'Estado sin confirmar',
  rejected: 'Transferencia rechazada',
  error: 'No se pudo enviar',
  pendingOtp: 'Confirma con tu código',
  confirmingOtp: 'Confirma con tu código',
  waitingOtpRetry: 'Confirma con tu código',
  otpUncertain: 'Estado sin confirmar',
  failed: 'La transferencia no se realizó',
  expired: 'El código venció',
  completed: 'Transferencia enviada',
};

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
          {TITLES[state.status]}
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
        >
          <AttemptActions attempt={attempt} state={state} />
        </ReviewView>
      ) : state.status === 'completed' ||
        state.status === 'failed' ||
        state.status === 'expired' ? (
        <OutcomeView
          attempt={attempt}
          state={state}
          fromAccountName={
            accountList.find((account) => account.id === state.transfer.fromAccountId)?.name
          }
        />
      ) : state.status === 'pendingOtp' ||
        state.status === 'confirmingOtp' ||
        state.status === 'waitingOtpRetry' ||
        state.status === 'otpUncertain' ? (
        <OtpView attempt={attempt} state={state} />
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
