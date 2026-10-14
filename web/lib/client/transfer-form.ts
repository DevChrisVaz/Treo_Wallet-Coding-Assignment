import { toFieldErrors, transferFormAt } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import type { FieldErrors, Resolver } from 'react-hook-form';
import type { ActionProblem } from '@/lib/action-result';
import { normalizeAmountInput } from '@/lib/money';
import type { TransferDraft, TransferFormValues } from './transfer-flow';

/** Petición `CreateTransferRequest` a partir de lo escrito; el monto pierde sus separadores. */
export function buildTransferRequest(values: TransferFormValues): unknown {
  return {
    fromAccountId: values.fromAccountId,
    destination:
      values.destinationType === 'OWN_ACCOUNT'
        ? { type: 'OWN_ACCOUNT', accountId: values.toAccountId }
        : { type: 'BENEFICIARY', beneficiaryId: values.beneficiaryId },
    amount: normalizeAmountInput(values.amount),
    concept: values.concept,
    reference: values.reference,
    // Con "Ahora" no se envía fecha, aunque se haya escrito una antes (WEB-33).
    ...(values.when === 'SCHEDULED' ? { scheduledFor: values.scheduledFor } : {}),
  };
}

const FIELD_BY_POINTER: Record<string, keyof TransferFormValues> = {
  '/fromAccountId': 'fromAccountId',
  '/destination/accountId': 'toAccountId',
  '/destination/beneficiaryId': 'beneficiaryId',
  '/amount': 'amount',
  '/concept': 'concept',
  '/reference': 'reference',
  '/scheduledFor': 'scheduledFor',
};

/** Errores de campo de un `VALIDATION_FAILED` de la API, por campo del formulario (WEB-33). */
export function serverFieldErrors(
  problem: ActionProblem | undefined,
): Partial<Record<keyof TransferFormValues, string>> {
  const fields: Partial<Record<keyof TransferFormValues, string>> = {};
  for (const error of problem?.errors ?? []) {
    const field = FIELD_BY_POINTER[error.pointer];
    if (field && !fields[field]) fields[field] = error.message;
  }
  return fields;
}

/** Los ids vienen de un selector: si falta uno, se pide elegir en lugar de "identificador". */
const CHOOSE_MESSAGES: Partial<Record<keyof TransferFormValues, string>> = {
  fromAccountId: 'Elige la cuenta de origen',
  toAccountId: 'Elige la cuenta de destino',
  beneficiaryId: 'Elige un beneficiario',
};

/**
 * Resolver del formulario de transferencia: valida la petición armada con `transferFormAt` del
 * contrato, el esquema de la Server Action más el rango programable de hoy (WEB-07, WEB-21, WEB-33).
 * Un monto con más de 2 decimales se rechaza; nunca se redondea.
 */
export const transferResolver: Resolver<TransferFormValues, unknown, TransferDraft> = (values) => {
  const errors: FieldErrors<TransferFormValues> = {};
  const parsed = transferFormAt(new Date()).safeParse(buildTransferRequest(values));
  if (!parsed.success) {
    for (const error of toFieldErrors(parsed.error)) {
      const field = FIELD_BY_POINTER[error.pointer];
      if (!field || errors[field]) continue;
      const message = CHOOSE_MESSAGES[field] ?? error.message;
      errors[field] = { type: error.code, message };
    }
  }
  if (
    values.destinationType === 'OWN_ACCOUNT' &&
    values.toAccountId !== '' &&
    values.toAccountId === values.fromAccountId &&
    !errors.toAccountId
  ) {
    errors.toAccountId = { type: 'SAME_ACCOUNT', message: problemMessage('SAME_ACCOUNT_TRANSFER') };
  }
  if (!parsed.success || Object.keys(errors).length > 0) {
    return { values: {} as Record<string, never>, errors };
  }
  return { values: { values, request: parsed.data }, errors: {} };
};
