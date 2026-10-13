import { ProblemError, type Transfer } from '@devchrisvaz/wallet-contract';

import type { TransferDraft, TransferTransport } from '@/features/transfer/transfer-attempt';

export const draft: TransferDraft = {
  fromAccountId: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  beneficiaryId: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
  amount: '1250',
  concept: 'Renta',
  reference: '1',
};

export const FROZEN_PAYLOAD =
  '{"fromAccountId":"0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51","destination":{"type":"BENEFICIARY","beneficiaryId":"5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61"},"amount":"1250","concept":"Renta","reference":"1"}';

export function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    status: 'COMPLETED',
    kind: 'THIRD_PARTY',
    fromAccountId: draft.fromAccountId,
    destination: {
      type: 'BENEFICIARY',
      accountId: null,
      beneficiaryId: draft.beneficiaryId,
      displayName: 'Luis',
      clabeLast4: '5678',
    },
    amount: '1250.00',
    concept: 'Renta',
    reference: '1',
    requiresOtp: false,
    otp: null,
    rejectionReason: null,
    failureReason: null,
    createdAt: '2026-10-13T16:41:00Z',
    completedAt: '2026-10-13T16:42:00Z',
    ...overrides,
  };
}

export const pendingOtp = (overrides: Partial<Transfer> = {}) =>
  transfer({
    status: 'PENDING_OTP',
    amount: '15000.00',
    requiresOtp: true,
    completedAt: null,
    otp: {
      channel: 'EMAIL',
      deliveryStatus: 'SENT',
      maskedDestination: 'an***@example.com',
      expiresAt: '2026-10-13T16:46:00Z',
      attemptsRemaining: 3,
      resendsRemaining: 3,
    },
    ...overrides,
  });

export function problemError(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new ProblemError(status, { code, title: 't', requestId: 'req-1', ...extra });
}

/**
 * Transporte simulado: cada llamada consume la siguiente respuesta y la última se repite. Llamar a
 * `onCreate`/`onConfirm` reemplaza las respuestas pendientes ("de aquí en adelante, responde así").
 */
export function fakeTransport() {
  const createReplies: (() => Promise<{ transfer: Transfer; replayed: boolean }>)[] = [];
  const confirmReplies: (() => Promise<Transfer>)[] = [];
  const transport: TransferTransport & {
    create: jest.Mock;
    confirm: jest.Mock;
  } = {
    create: jest.fn(async () => {
      const next = createReplies.length > 1 ? createReplies.shift() : createReplies[0];
      if (!next) throw new Error('Sin respuesta simulada para create');
      return next();
    }),
    confirm: jest.fn(async () => {
      const next = confirmReplies.length > 1 ? confirmReplies.shift() : confirmReplies[0];
      if (!next) throw new Error('Sin respuesta simulada para confirm');
      return next();
    }),
  };
  return {
    transport,
    onCreate(...replies: (() => Promise<{ transfer: Transfer; replayed: boolean }>)[]) {
      createReplies.splice(0, createReplies.length, ...replies);
    },
    onConfirm(...replies: (() => Promise<Transfer>)[]) {
      confirmReplies.splice(0, confirmReplies.length, ...replies);
    },
  };
}

export const resolves =
  <T>(value: T) =>
  () =>
    Promise.resolve(value);
export const rejects = (error: unknown) => () => Promise.reject(error);
export const never = () => () => new Promise<never>(() => {});
