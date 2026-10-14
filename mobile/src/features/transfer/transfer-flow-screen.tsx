import { sanitizeAmountTyping } from '@devchrisvaz/wallet-contract';
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
  // Lecturas que aún no tienen datos. Con datos en caché, un refresco fallido (p. ej. al invalidar
  // los saldos tras completar, MOB-13) no reemplaza el paso en curso: TanStack conserva `data`.
  const missing = [accounts, beneficiaries].filter((query) => query.data === undefined);
  const loadError = missing.find((query) => query.error)?.error;
  const data: TransferFlowViewProps['data'] =
    missing.length === 0
      ? {
          status: 'success',
          data: {
            accounts: accountList,
            beneficiary: beneficiaries.data?.items.find((item) => item.id === beneficiaryId),
          },
        }
      : loadError
        ? { status: 'error', message: errorMessage(loadError) }
        : { status: 'pending' };

  return (
    <TransferFlowView
      state={state}
      data={data}
      values={{ ...values, fromAccountId }}
      errors={errors}
      code={code}
      actions={{
        onClose: () => router.dismissTo('/'),
        onReload: () => missing.forEach((query) => void query.refetch()),
        onChange: setValues,
        onContinue: () => {
          const result = attempt.review({
            fromAccountId: fromAccountId ?? '',
            beneficiaryId,
            // El campo guarda el texto con comas (MOB-08); a la API va el monto normalizado.
            amount: sanitizeAmountTyping(values.amount).value,
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
