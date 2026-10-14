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
  /** "Ahora" o "Programar" (WEB-33); la fecha y la hora solo se envían con "Programar". */
  when: 'NOW' | 'SCHEDULED';
  /** Fecha de envío (`YYYY-MM-DD`, Ciudad de México). Se combina con `scheduledTime` en un instante (WEB-33). */
  scheduledFor: string;
  /** Hora de envío (`HH:mm`, Ciudad de México). */
  scheduledTime: string;
}

/** Destino elegido en el primer paso (WEB-30). */
export type TransferRecipient =
  | { destinationType: 'OWN_ACCOUNT'; toAccountId: string }
  | { destinationType: 'BENEFICIARY'; beneficiaryId: string };

/** El destino de lo que se escribió, para volver al paso de monto con él al editar. */
export function recipientOf(values: TransferFormValues): TransferRecipient {
  return values.destinationType === 'OWN_ACCOUNT'
    ? { destinationType: 'OWN_ACCOUNT', toAccountId: values.toAccountId }
    : { destinationType: 'BENEFICIARY', beneficiaryId: values.beneficiaryId };
}

/** Un intento: lo que se escribió (para editar) y la petición validada (para enviar). */
export interface TransferDraft {
  values: TransferFormValues;
  request: CreateTransferRequest;
}

export type ConfirmStatus = 'idle' | 'sending' | 'uncertain' | 'rejected';

export type TransferFlowState =
  | { step: 'recipient'; draft: TransferDraft | null }
  | {
      step: 'form';
      draft: TransferDraft | null;
      recipient: TransferRecipient;
      /** Error de campo de la API, para mostrarlo junto al campo al volver al monto (WEB-33). */
      problem?: ActionProblem;
    }
  | {
      step: 'confirm';
      draft: TransferDraft;
      status: ConfirmStatus;
      error?: unknown;
      problem?: ActionProblem;
    }
  | { step: 'otp'; transfer: Transfer; replayed: boolean }
  | { step: 'receipt'; transfer: Transfer; replayed: boolean }
  /** `transfer`: la que se intentó confirmar con el código, para su comprobante (WEB-18). */
  | { step: 'ended'; problem: ActionProblem; transfer: Transfer | null };

type FlowEvent =
  | { type: 'CHOOSE'; recipient: TransferRecipient }
  | { type: 'REVIEW'; draft: TransferDraft }
  | { type: 'EDIT' }
  | { type: 'SENDING' }
  | { type: 'UNCERTAIN'; error: unknown }
  | { type: 'REJECTED'; problem: ActionProblem }
  | { type: 'INVALID'; problem: ActionProblem }
  | { type: 'SENT'; transfer: Transfer; replayed: boolean }
  | { type: 'CONFIRMED'; transfer: Transfer }
  | { type: 'ENDED'; problem: ActionProblem }
  | { type: 'RESTART' };

const INITIAL: TransferFlowState = { step: 'recipient', draft: null };

/**
 * Máquina de estados del flujo (D6 de web-app, WEB-30): destinatario → monto → confirmación →
 * (código) → comprobante. Es pura; la llave de idempotencia la maneja `useTransferFlow`.
 */
export function transferFlowReducer(state: TransferFlowState, event: FlowEvent): TransferFlowState {
  switch (event.type) {
    case 'CHOOSE':
      return state.step === 'recipient'
        ? { step: 'form', draft: state.draft, recipient: event.recipient }
        : state;
    case 'REVIEW':
      return { step: 'confirm', draft: event.draft, status: 'idle' };
    case 'EDIT':
      return state.step === 'confirm'
        ? { step: 'form', draft: state.draft, recipient: recipientOf(state.draft.values) }
        : state;
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
    case 'INVALID':
      // Un error de campo de la API se corrige en el paso de monto, junto al campo (WEB-33).
      return state.step === 'confirm'
        ? {
            step: 'form',
            draft: state.draft,
            recipient: recipientOf(state.draft.values),
            problem: event.problem,
          }
        : state;
    case 'SENT':
      return event.transfer.status === 'PENDING_OTP'
        ? { step: 'otp', transfer: event.transfer, replayed: event.replayed }
        : { step: 'receipt', transfer: event.transfer, replayed: event.replayed };
    case 'CONFIRMED':
      return { step: 'receipt', transfer: event.transfer, replayed: false };
    case 'ENDED':
      return {
        step: 'ended',
        problem: event.problem,
        transfer: state.step === 'otp' ? state.transfer : null,
      };
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
 * definitiva (`COMPLETED`, `PENDING_OTP` o un rechazo). Con `start` (el beneficiario de un acceso
 * directo) empieza en el monto; reiniciar siempre vuelve al destinatario.
 */
export function useTransferFlow(generate?: () => string, start: TransferRecipient | null = null) {
  const { key, issue, discard } = useIdempotencyKey(generate);
  const [state, dispatch] = useReducer(transferFlowReducer, start, (first): TransferFlowState =>
    first ? { step: 'form', draft: null, recipient: first } : INITIAL,
  );

  const actions = useMemo(
    () => ({
      choose(recipient: TransferRecipient) {
        // La llave se emite al pasar a la revisión, no aquí.
        dispatch({ type: 'CHOOSE', recipient });
      },
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
      invalid(problem: ActionProblem) {
        discard();
        dispatch({ type: 'INVALID', problem });
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
