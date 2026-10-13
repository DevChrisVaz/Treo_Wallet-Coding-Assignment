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
    [300, 'Intenta de nuevo en 5 minutos.'],
    [61, 'Intenta de nuevo en 2 minutos.'],
    [30, 'Intenta de nuevo en 1 minuto.'],
  ])('WEB-12 con Retry-After %i indica cuánto esperar: "%s"', (retryAfter, wait) => {
    expect(describeProblem(problem('RATE_LIMITED', { status: 429, retryAfter }))).toBe(
      `${problemMessage('RATE_LIMITED')} ${wait}`,
    );
  });
});
