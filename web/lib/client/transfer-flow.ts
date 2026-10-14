'use client';

import {
  createIdempotencyKey,
  type CreateTransferRequest,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import { useCallback, useMemo, useReducer, useState } from 'react';
import type { ActionProblem } from '@/lib/action-result';

/** Valores del formulario de transferencia, como los escribe la persona (texto). */
export interface TransferFormValues {
  fromAccountId: string;
  destinationType: 'OWN_ACCOUNT' | 'BENEFICIARY';
  toAccountId: string;
  beneficiaryId: string;
  amount: string;
  concept: string;
  reference: string;
}

/** Un intento: lo que se escribió (para editar) y la petición validada (para enviar). */
export interface TransferDraft {
  values: TransferFormValues;
  request: CreateTransferRequest;
}

export type ConfirmStatus = 'idle' | 'sending' | 'uncertain' | 'rejected';

export type TransferFlowState =
  | { step: 'form'; draft: TransferDraft | null }
  | {
      step: 'confirm';
      draft: TransferDraft;
      status: ConfirmStatus;
      error?: unknown;
      problem?: ActionProblem;
    }
  | { step: 'otp'; transfer: Transfer; replayed: boolean }
  | { step: 'receipt'; transfer: Transfer; replayed: boolean }
  | { step: 'ended'; problem: ActionProblem };

type FlowEvent =
  | { type: 'REVIEW'; draft: TransferDraft }
  | { type: 'EDIT' }
  | { type: 'SENDING' }
  | { type: 'UNCERTAIN'; error: unknown }
  | { type: 'REJECTED'; problem: ActionProblem }
  | { type: 'SENT'; transfer: Transfer; replayed: boolean }
  | { type: 'CONFIRMED'; transfer: Transfer }
  | { type: 'ENDED'; problem: ActionProblem }
  | { type: 'RESTART' };

const INITIAL: TransferFlowState = { step: 'form', draft: null };

/**
 * Máquina de estados del flujo (D6 de web-app): formulario → confirmación → (código) →
 * comprobante. Es pura; la llave de idempotencia la maneja `useTransferFlow`.
 */
export function transferFlowReducer(state: TransferFlowState, event: FlowEvent): TransferFlowState {
  switch (event.type) {
    case 'REVIEW':
      return { step: 'confirm', draft: event.draft, status: 'idle' };
    case 'EDIT':
      return state.step === 'confirm' ? { step: 'form', draft: state.draft } : state;
    case 'SENDING':
      return state.step === 'confirm'
        ? { step: 'confirm', draft: state.draft, status: 'sending' }
        : state;
    case 'UNCERTAIN':
      return state.step === 'confirm'
        ? { step: 'confirm', draft: state.draft, status: 'uncertain', error: event.error }
        : state;
    case 'REJECTED':
      return state.step === 'confirm'
        ? { step: 'confirm', draft: state.draft, status: 'rejected', problem: event.problem }
        : state;
    case 'SENT':
      return event.transfer.status === 'PENDING_OTP'
        ? { step: 'otp', transfer: event.transfer, replayed: event.replayed }
        : { step: 'receipt', transfer: event.transfer, replayed: event.replayed };
    case 'CONFIRMED':
      return { step: 'receipt', transfer: event.transfer, replayed: false };
    case 'ENDED':
      return { step: 'ended', problem: event.problem };
    case 'RESTART':
      return INITIAL;
  }
}

/**
 * Llave de idempotencia del intento en curso (D6 y WEB-17). Vive en el estado del componente, no en
 * almacenamiento persistente: recargar la página inicia un intento nuevo.
 */
export function useIdempotencyKey(generate: () => string = createIdempotencyKey) {
  const [key, setKey] = useState<string | null>(null);
  const issue = useCallback(() => {
    const next = generate();
    setKey(next);
    return next;
  }, [generate]);
  const discard = useCallback(() => setKey(null), []);
  return { key, issue, discard };
}

/**
 * Flujo de transferencia con su llave: se genera al pasar a la confirmación, se conserva al
 * reintentar tras un fallo de red o 5xx, y se descarta al editar o al recibir una respuesta
 * definitiva (`COMPLETED`, `PENDING_OTP` o un rechazo).
 */
export function useTransferFlow(generate?: () => string) {
  const { key, issue, discard } = useIdempotencyKey(generate);
  const [state, dispatch] = useReducer(transferFlowReducer, INITIAL);

  const actions = useMemo(
    () => ({
      review(draft: TransferDraft) {
        issue();
        dispatch({ type: 'REVIEW', draft });
      },
      edit() {
        discard();
        dispatch({ type: 'EDIT' });
      },
      sending() {
        dispatch({ type: 'SENDING' });
      },
      uncertain(error: unknown) {
        dispatch({ type: 'UNCERTAIN', error });
      },
      rejected(problem: ActionProblem) {
        discard();
        dispatch({ type: 'REJECTED', problem });
      },
      sent(transfer: Transfer, replayed: boolean) {
        discard();
        dispatch({ type: 'SENT', transfer, replayed });
      },
      confirmed(transfer: Transfer) {
        dispatch({ type: 'CONFIRMED', transfer });
      },
      ended(problem: ActionProblem) {
        discard();
        dispatch({ type: 'ENDED', problem });
      },
      restart() {
        discard();
        dispatch({ type: 'RESTART' });
      },
    }),
    [issue, discard],
  );

  return { state, key, ...actions };
}
