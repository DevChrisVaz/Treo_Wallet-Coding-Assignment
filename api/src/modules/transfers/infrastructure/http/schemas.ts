import * as z from 'zod';
import {
  addFieldIssue,
  codePointLength,
  textField,
  type FieldContext,
} from '../../../../platform/http/validation.js';
import { DomainError } from '../../../../shared/errors.js';
import { Money, MoneyParseError } from '../../../../shared/money.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_EDGE_SPACES = /^\S(.*\S)?$/u;

export type TransferDestinationInput =
  | { readonly type: 'OWN_ACCOUNT'; readonly id: string }
  | { readonly type: 'BENEFICIARY'; readonly id: string };

function issueAt(
  ctx: FieldContext,
  path: string[],
  code: Parameters<typeof addFieldIssue>[1],
  message: string,
) {
  ctx.addIssue({ code: 'custom', message, path, params: { fieldCode: code } });
}

const uuidField = textField({
  check: (value, ctx) => {
    if (!UUID.test(value)) addFieldIssue(ctx, 'INVALID_FORMAT', 'Debe ser un UUID');
  },
}).transform((value) => value.toLowerCase());

/** Monto solo como string; se interpreta con `Money.parse` (sin floats ni redondeo). */
const amountField = textField({
  check: (value, ctx) => {
    try {
      Money.parse(value);
    } catch (error) {
      if (error instanceof MoneyParseError) addFieldIssue(ctx, error.code, error.message);
      else throw error;
    }
  },
}).transform((value) => Money.parse(value));

/**
 * Destino como unión discriminada por `type` (TRF-01, TRF-06), con errores deterministas por campo:
 * cada variante exige su id y rechaza los campos de la otra.
 */
const destinationField = z
  .unknown()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) {
      return addFieldIssue(ctx, 'REQUIRED', 'El destino es obligatorio');
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return addFieldIssue(ctx, 'INVALID_TYPE', 'El destino debe ser un objeto');
    }
    const destination = value as Record<string, unknown>;
    const idKey =
      destination.type === 'OWN_ACCOUNT'
        ? 'accountId'
        : destination.type === 'BENEFICIARY'
          ? 'beneficiaryId'
          : undefined;
    if (!idKey) {
      return issueAt(
        ctx,
        ['type'],
        destination.type === undefined ? 'REQUIRED' : 'INVALID_FORMAT',
        'El tipo de destino debe ser OWN_ACCOUNT o BENEFICIARY',
      );
    }
    for (const key of Object.keys(destination)) {
      if (key !== 'type' && key !== idKey)
        issueAt(ctx, [key], 'UNKNOWN_FIELD', 'Campo no permitido');
    }
    const id = destination[idKey];
    if (id === undefined || id === null)
      issueAt(ctx, [idKey], 'REQUIRED', 'Falta el id del destino');
    else if (typeof id !== 'string') issueAt(ctx, [idKey], 'INVALID_TYPE', 'Debe ser texto');
    else if (!UUID.test(id)) issueAt(ctx, [idKey], 'INVALID_FORMAT', 'Debe ser un UUID');
  })
  .transform((value): TransferDestinationInput => {
    const destination = value as {
      type: 'OWN_ACCOUNT' | 'BENEFICIARY';
      accountId?: string;
      beneficiaryId?: string;
    };
    const id = (
      destination.type === 'OWN_ACCOUNT' ? destination.accountId : destination.beneficiaryId
    ) as string;
    return { type: destination.type, id: id.toLowerCase() };
  });

/**
 * `CreateTransferRequest` (TRF-08, TRF-09): monto como string decimal positivo con 0 a 2 decimales,
 * concepto de 1 a 40 caracteres sin espacios en los extremos y referencia de 1 a 7 dígitos, que
 * se interpreta como número (0 a 9999999).
 */
export const createTransferRequestSchema = z.strictObject({
  fromAccountId: uuidField,
  destination: destinationField,
  amount: amountField,
  concept: textField({
    check: (value, ctx) => {
      if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El concepto es obligatorio');
      if (codePointLength(value) > 40) {
        return addFieldIssue(ctx, 'TOO_LONG', 'El concepto admite máximo 40 caracteres');
      }
      if (!NO_EDGE_SPACES.test(value)) {
        addFieldIssue(
          ctx,
          'INVALID_FORMAT',
          'El concepto no puede empezar ni terminar con espacios',
        );
      }
    },
  }),
  reference: textField({
    check: (value, ctx) => {
      if (!/^[0-9]+$/.test(value)) {
        return addFieldIssue(ctx, 'INVALID_FORMAT', 'La referencia solo admite dígitos');
      }
      if (value.length > 7) addFieldIssue(ctx, 'TOO_LONG', 'La referencia admite máximo 7 dígitos');
    },
  }).transform((value) => Number.parseInt(value, 10)),
});

export type CreateTransferInput = z.output<typeof createTransferRequestSchema>;

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
