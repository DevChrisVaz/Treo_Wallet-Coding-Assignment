import type {
  Account,
  AccountsOverview,
  Beneficiary,
  DailyLimit,
  Movement,
  ProblemCode,
  Transfer,
  User,
} from '@devchrisvaz/wallet-contract';
import type { ActionProblem } from '@/lib/action-result';

/** Datos de ejemplo con la forma exacta del contrato. */

export const USER: User = {
  id: '6f1c2a8e-1d2b-4c3d-9e4f-5a6b7c8d9e0f',
  email: 'ana@example.com',
  fullName: 'Ana Gómez Castillo',
  phoneMasked: '+52******5678',
  curpMasked: 'GOCA**************',
  rfcMasked: 'GOCA*********',
  emailVerifiedAt: '2026-10-01T15:00:00.000Z',
  createdAt: '2026-10-01T14:55:00.000Z',
};

export const PRINCIPAL: Account = {
  id: '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a',
  name: 'Principal',
  clabe: '032180000118359719',
  balance: '25000.00',
  currency: 'MXN',
  createdAt: '2026-10-01T15:00:00.000Z',
};

export const AHORRO: Account = {
  id: '1c8e7a6f-5d4c-4b3a-9298-7a6f5e4d3c2b',
  name: 'Ahorro',
  clabe: '032180000118359722',
  balance: '10000.00',
  currency: 'MXN',
  createdAt: '2026-10-01T15:00:00.000Z',
};

export const DAILY_LIMIT: DailyLimit = {
  limit: '50000.00',
  used: '12000.00',
  remaining: '38000.00',
  resetsAt: '2026-10-14T06:00:00.000Z',
  timeZone: 'America/Mexico_City',
};

export const OVERVIEW: AccountsOverview = {
  accounts: [PRINCIPAL, AHORRO],
  dailyLimit: DAILY_LIMIT,
};

export const BENEFICIARY: Beneficiary = {
  id: '2d9f8b7a-6e5d-4c4b-8a39-8b7a6f5e4d3c',
  name: 'Luis Pérez Ramírez',
  alias: 'Luis',
  clabe: '032180000118359735',
  createdAt: '2026-10-02T18:00:00.000Z',
};

export function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'mov-1',
    type: 'TRANSFER_IN',
    amount: '1500.00',
    balanceAfter: '26500.00',
    concept: 'Renta de octubre',
    reference: '1234',
    counterparty: { name: 'Luis Pérez', clabeLast4: '9735' },
    transferId: '3e0a9c8b-7f6e-4d5c-8b4a-9c8b7a6f5e4d',
    occurredAt: '2026-10-13T16:42:00.000Z',
    ...overrides,
  };
}

export function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
    status: 'COMPLETED',
    kind: 'THIRD_PARTY',
    fromAccountId: PRINCIPAL.id,
    destination: {
      type: 'BENEFICIARY',
      accountId: null,
      beneficiaryId: BENEFICIARY.id,
      displayName: 'Luis',
      clabeLast4: '9735',
    },
    amount: '5000.00',
    concept: 'Renta',
    reference: '1',
    requiresOtp: false,
    otp: null,
    rejectionReason: null,
    failureReason: null,
    createdAt: '2026-10-13T16:42:00.000Z',
    completedAt: '2026-10-13T16:42:01.000Z',
    ...overrides,
  };
}

export function pendingOtpTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return transfer({
    status: 'PENDING_OTP',
    amount: '15000.00',
    requiresOtp: true,
    completedAt: null,
    otp: {
      channel: 'EMAIL',
      deliveryStatus: 'SENT',
      maskedDestination: 'an***@example.com',
      expiresAt: '2026-10-13T16:52:00.000Z',
      attemptsRemaining: 3,
      resendsRemaining: 3,
    },
    ...overrides,
  });
}

export function problem(code: ProblemCode, overrides: Partial<ActionProblem> = {}): ActionProblem {
  return {
    type: `/problems/${code.toLowerCase().replace(/_/g, '-')}`,
    title: code,
    status: 422,
    code,
    requestId: '01JABC',
    ...overrides,
  };
}
