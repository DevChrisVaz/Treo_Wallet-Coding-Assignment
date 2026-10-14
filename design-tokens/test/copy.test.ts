import { describe, expect, it } from 'vitest';
import { problemMessage, problemMessages } from '../src/index';

/** Los 28 códigos de ProblemCode del contrato 1.2.0, escritos a mano. */
const CONTRACT_CODES = [
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
];

describe('problemMessage', () => {
  it('DSG-12 saldo insuficiente usa el texto de la spec', () => {
    expect(problemMessage('INSUFFICIENT_FUNDS')).toBe(
      'No tienes saldo suficiente para esta transferencia.',
    );
  });

  it('DSG-18 el tope de programadas dice qué hacer', () => {
    expect(problemMessage('SCHEDULED_LIMIT_REACHED')).toBe(
      'Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra.',
    );
  });

  it('DSG-18 una transferencia que ya no se puede cancelar', () => {
    expect(problemMessage('TRANSFER_NOT_CANCELLABLE')).toBe(
      'Esta transferencia ya no se puede cancelar.',
    );
  });

  it('DSG-12 un código desconocido muestra el mensaje de INTERNAL_ERROR', () => {
    expect(problemMessage('SOMETHING_NEW')).toBe(
      'Algo falló de nuestro lado. Intenta de nuevo en unos minutos.',
    );
  });

  it('DSG-12 hay un mensaje para cada código del contrato', () => {
    expect(Object.keys(problemMessages).sort()).toEqual([...CONTRACT_CODES].sort());
  });

  it.each(Object.entries(problemMessages))(
    'DSG-12 %s: oración completa, sin disculpas ni términos técnicos',
    (_code, message) => {
      expect(message).toMatch(/^[A-ZÁÉÍÓÚÑ¿¡].*[.]$/u);
      expect(message).not.toMatch(/lo sentimos|disculpa|perdón|error \d|http|api|token|null/i);
    },
  );
});
