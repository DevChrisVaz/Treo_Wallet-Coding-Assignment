import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useAccountsOverview, useBeneficiaries } from '@/features/accounts/queries';
import { errorMessage } from '@/lib/errors';

import type { FormValues } from './form-view';
import { TransferFlowView, type TransferFlowViewProps } from './transfer-flow-view';
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
  const { attempt, state } = useTransferAttempt();
  const [values, setValues] = useState<FormValues>({
    fromAccountId: undefined,
    amount: '',
    concept: '',
    reference: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const accountList = accounts.data?.accounts ?? [];
  const fromAccountId = values.fromAccountId ?? accountList[0]?.id;
  const loadError = accounts.error ?? beneficiaries.error;
  const data: TransferFlowViewProps['data'] =
    accounts.isPending || beneficiaries.isPending
      ? { status: 'pending' }
      : loadError
        ? { status: 'error', message: errorMessage(loadError) }
        : {
            status: 'success',
            data: {
              accounts: accountList,
              beneficiary: beneficiaries.data?.items.find((item) => item.id === beneficiaryId),
            },
          };

  return (
    <TransferFlowView
      state={state}
      data={data}
      values={{ ...values, fromAccountId }}
      errors={errors}
      code={code}
      actions={{
        onClose: () => router.dismissTo('/'),
        onChange: setValues,
        onContinue: () => {
          const result = attempt.review({
            fromAccountId: fromAccountId ?? '',
            beneficiaryId,
            amount: values.amount,
            concept: values.concept,
            reference: values.reference,
          });
          setErrors(result.ok ? {} : result.errors);
        },
        onSubmit: () => void attempt.submit(),
        onEdit: () => attempt.edit(),
        onRetry: () => void attempt.retry(),
        onCodeChange: setCode,
        onConfirm: () => void attempt.confirmOtp(code),
        onResend: () => void attempt.resendOtp(),
        onRestart: () => {
          setCode('');
          attempt.restart();
        },
        onHome: () => router.dismissTo('/'),
        onAnother: () => router.dismissTo('/transfer'),
      }}
    />
  );
}
