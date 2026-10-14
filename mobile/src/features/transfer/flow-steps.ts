import { toCents } from '@devchrisvaz/wallet-contract';

import type { AttemptState } from './transfer-attempt';

/** Montos mayores a 10,000.00 MXN piden un código por correo (HU6). */
const OTP_THRESHOLD_CENTS = toCents('10000.00');

export function requiresOtp(amount: string): boolean {
  return toCents(amount) > OTP_THRESHOLD_CENTS;
}

export const UNCERTAIN_TITLE = 'No pudimos confirmar el estado de tu transferencia';

export interface FlowHeading {
  title: string;
  step: number;
  total: number;
  label: string;
}

export const RECIPIENT_HEADING: FlowHeading = {
  title: '¿A quién le envías?',
  step: 1,
  total: 5,
  label: 'Destinatario',
};

const TITLES: Record<AttemptState['status'], string> = {
  editing: '¿Cuánto envías?',
  reviewing: 'Revisa tu transferencia',
  sending: 'Enviando tu transferencia',
  waitingRetry: 'Enviando tu transferencia',
  rateLimited: 'Espera un momento',
  uncertain: 'Estado sin confirmar',
  rejected: 'Transferencia rechazada',
  error: 'No se pudo enviar',
  pendingOtp: 'Confirma con tu código',
  confirmingOtp: 'Confirma con tu código',
  waitingOtpRetry: 'Confirma con tu código',
  otpUncertain: 'Estado sin confirmar',
  failed: 'La transferencia no se realizó',
  expired: 'El código venció',
  completed: 'Transferencia enviada',
};

/** Título e indicador del paso (MOB-21); el total pasa a 4 cuando el monto no pide código (R36). */
export function flowHeading(state: AttemptState): FlowHeading {
  const title = TITLES[state.status];
  switch (state.status) {
    case 'editing':
      return { title, step: 2, total: 5, label: 'Monto' };
    case 'pendingOtp':
    case 'confirmingOtp':
    case 'waitingOtpRetry':
    case 'otpUncertain':
      return { title, step: 4, total: 5, label: 'Código' };
    case 'completed': {
      const total = state.transfer.requiresOtp ? 5 : 4;
      return { title, step: total, total, label: 'Comprobante' };
    }
    case 'failed':
    case 'expired':
      return { title, step: 5, total: 5, label: 'Comprobante' };
    default:
      return { title, step: 3, total: requiresOtp(state.draft.amount) ? 5 : 4, label: 'Revisión' };
  }
}
