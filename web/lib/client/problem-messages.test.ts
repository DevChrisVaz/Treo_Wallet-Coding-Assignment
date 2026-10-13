import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { describe, expect, it } from 'vitest';
import { problem } from '@/test/fixtures';
import { describeProblem } from './problem-messages';

describe('describeProblem', () => {
  it('WEB-12 DSG-12 las credenciales inválidas usan el mensaje genérico del paquete de diseño', () => {
    expect(describeProblem(problem('INVALID_CREDENTIALS', { status: 401 }))).toBe(
      problemMessage('INVALID_CREDENTIALS'),
    );
  });

  it.each([
    ['VERIFICATION_CODE_INVALID', 2, 'Te quedan 2 intentos.'],
    ['OTP_INVALID', 1, 'Te queda 1 intento.'],
    ['OTP_INVALID', 0, 'Ya no te quedan intentos.'],
  ] as const)('WEB-11 WEB-18 %s con %i intentos agrega "%s"', (code, attemptsRemaining, text) => {
    expect(describeProblem(problem(code, { attemptsRemaining }))).toBe(
      `${problemMessage(code)} ${text}`,
    );
  });

  it.each([
    [300, 'Intenta de nuevo en 5 minutos.'],
    [61, 'Intenta de nuevo en 2 minutos.'],
    [30, 'Intenta de nuevo en 1 minuto.'],
  ])('WEB-12 con Retry-After %i indica cuánto esperar: "%s"', (retryAfter, wait) => {
    expect(describeProblem(problem('RATE_LIMITED', { status: 429, retryAfter }))).toBe(
      `${problemMessage('RATE_LIMITED')} ${wait}`,
    );
  });
});
