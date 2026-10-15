import * as z from 'zod';
import { addFieldIssue, textField } from '../../../../platform/http/validation.js';
import { DomainError } from '../../../../shared/errors.js';
import { Money } from '../../../../shared/money.js';
import { parseInstant, transferForm } from '@devchrisvaz/wallet-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TransferDestinationInput =
  | { readonly type: 'OWN_ACCOUNT'; readonly id: string }
  | { readonly type: 'BENEFICIARY'; readonly id: string };

/**
 * `CreateTransferRequest` (TRF-08, TRF-09, TRF-27). Las reglas de cada campo (UUID, destino, monto,
 * concepto, referencia, instante programado) son las de `transferForm` del contrato (CTR-13), las
 * mismas que valida la web; aquí solo se interpretan los valores ya válidos: ids en minúsculas, monto
 * en centavos (`Money`, sin floats ni redondeo), referencia como número (0 a 9999999) o `null`, e
 * instante como `Date`. La ventana del instante (10 minutos a 90 días) depende de la hora, así que
 * la valida el caso de uso con el `Clock`.
 */
export const createTransferRequestSchema = transferForm.transform((form) => {
  const destination: TransferDestinationInput =
    form.destination.type === 'OWN_ACCOUNT'
      ? { type: 'OWN_ACCOUNT', id: form.destination.accountId.toLowerCase() }
      : { type: 'BENEFICIARY', id: form.destination.beneficiaryId.toLowerCase() };
  return {
    fromAccountId: form.fromAccountId.toLowerCase(),
    destination,
    amount: Money.parse(form.amount),
    concept: form.concept,
    reference: form.reference === undefined ? null : Number.parseInt(form.reference, 10),
    scheduledFor: form.scheduledFor === undefined ? undefined : toInstant(form.scheduledFor),
  };
});

function toInstant(value: string): Date {
  return parseInstant(value) ?? new Date(Number.NaN);
}

export type CreateTransferInput = z.output<typeof createTransferRequestSchema>;

/** `ConfirmTransferRequest` (TRF-16): el código de 6 dígitos como string. */
export const confirmTransferRequestSchema = z.strictObject({
  otp: textField({
    check: (value, ctx) => {
      if (!/^[0-9]{6}$/.test(value)) {
        addFieldIssue(ctx, 'INVALID_FORMAT', 'El código debe tener 6 dígitos');
      }
    },
  }),
});

/** Header `Idempotency-Key` (TRF-02): obligatorio y UUID; se normaliza a minúsculas. */
export function parseIdempotencyKey(header: string | undefined): string {
  if (header === undefined || header.trim() === '') {
    throw new DomainError('IDEMPOTENCY_KEY_MISSING', 'Falta el header Idempotency-Key');
  }
  if (!UUID.test(header.trim())) {
    throw new DomainError('IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key debe ser un UUID');
  }
  return header.trim().toLowerCase();
}
