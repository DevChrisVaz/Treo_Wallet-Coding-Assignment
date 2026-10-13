import { describe, expect, it } from 'vitest';
import { problemMessage, problemMessages } from '../src/index';

/** Los 26 códigos de ProblemCode del contrato 1.0.x, escritos a mano. */
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
