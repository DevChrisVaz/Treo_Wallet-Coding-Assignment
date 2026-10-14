import type { components, operations, paths } from './generated/api';

export type { components, operations, paths };

type Schemas = components['schemas'];

// Usuarios y sesión
export type User = Schemas['User'];
export type TokenPair = Schemas['TokenPair'];
export type AuthSession = Schemas['AuthSession'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type VerifyEmailRequest = Schemas['VerifyEmailRequest'];
export type LoginRequest = Schemas['LoginRequest'];

// Cuentas y movimientos
export type Account = Schemas['Account'];
export type AccountsOverview = Schemas['AccountsOverview'];
export type DailyLimit = Schemas['DailyLimit'];
export type Movement = Schemas['Movement'];
export type MovementType = Schemas['MovementType'];
export type MovementPage = Schemas['MovementPage'];
export type Counterparty = Schemas['Counterparty'];

// Beneficiarios
export type Beneficiary = Schemas['Beneficiary'];
export type BeneficiaryList = Schemas['BeneficiaryList'];
export type CreateBeneficiaryRequest = Schemas['CreateBeneficiaryRequest'];

// Transferencias
export type CreateTransferRequest = Schemas['CreateTransferRequest'];
export type TransferDestination = Schemas['TransferDestination'];
export type OwnAccountDestination = Schemas['OwnAccountDestination'];
export type BeneficiaryDestination = Schemas['BeneficiaryDestination'];
export type Transfer = Schemas['Transfer'];
export type TransferStatus = Schemas['TransferStatus'];
export type TransferKind = Schemas['TransferKind'];
export type OtpChallenge = Schemas['OtpChallenge'];
export type ScheduledTransferList = Schemas['ScheduledTransferList'];

// Errores
export type Problem = Schemas['Problem'];
export type ProblemCode = Schemas['ProblemCode'];
export type FieldError = Schemas['FieldError'];
export type FieldErrorCode = Schemas['FieldErrorCode'];

/**
 * Todos los valores de `ProblemCode`. `satisfies` impide agregar un código que no existe en el
 * contrato; la prueba de paridad impide que falte alguno.
 */
export const PROBLEM_CODES = [
  'MALFORMED_REQUEST',
  'IDEMPOTENCY_KEY_MISSING',
  'IDEMPOTENCY_KEY_INVALID',
  'INVALID_CURSOR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'SESSION_REVOKED',
  'EMAIL_NOT_VERIFIED',
  'NOT_FOUND',
  'BENEFICIARY_CONFLICT',
  'TRANSFER_NOT_PENDING',
  'TRANSFER_EXPIRED',
  'TRANSFER_NOT_CANCELLABLE',
  'VALIDATION_FAILED',
  'INSUFFICIENT_FUNDS',
  'DAILY_LIMIT_EXCEEDED',
  'SAME_ACCOUNT_TRANSFER',
  'IDEMPOTENCY_KEY_REUSED',
  'CLABE_INVALID',
  'CLABE_NOT_IN_PLATFORM',
  'BENEFICIARY_IS_OWN_ACCOUNT',
  'OTP_INVALID',
  'OTP_ATTEMPTS_EXHAUSTED',
  'RESEND_LIMIT_REACHED',
  'SCHEDULED_LIMIT_REACHED',
  'VERIFICATION_CODE_INVALID',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const satisfies readonly ProblemCode[];
