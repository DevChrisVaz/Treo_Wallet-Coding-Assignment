import { NetworkError, PROBLEM_CODES, ProblemError } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { describe, expect, it } from 'vitest';
import { problem } from '@/test/fixtures';
import { CONNECTION_ERROR, describeError, describeProblem } from './problem-messages';

describe('describeProblem', () => {
  it('WEB-19 DSG-12 cada ProblemCode del contrato tiene su propio mensaje en el paquete de diseño', () => {
    const generic = problemMessage('INTERNAL_ERROR');
    for (const code of PROBLEM_CODES) {
      if (code === 'INTERNAL_ERROR') continue;
      expect(problemMessage(code), code).not.toBe(generic);
    }
  });

  it('WEB-12 DSG-12 las credenciales inválidas usan el mensaje genérico del paquete de diseño', () => {
    expect(describeProblem(problem('INVALID_CREDENTIALS', { status: 401 }))).toBe(
      problemMessage('INVALID_CREDENTIALS'),
    );
  });

  it('DSG-12 WEB-16 el saldo insuficiente usa el texto del paquete de diseño', () => {
    expect(describeProblem(problem('INSUFFICIENT_FUNDS'))).toBe(
      'No tienes saldo suficiente para esta transferencia.',
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

  it('WEB-19 el límite diario indica cuánto puede enviar hoy, con formatMXN', () => {
    expect(describeProblem(problem('DAILY_LIMIT_EXCEEDED', { remaining: '2000.00' }))).toBe(
      `${problemMessage('DAILY_LIMIT_EXCEEDED')} Hoy puedes enviar hasta $2,000.00.`,
    );
  });

  it('WEB-19 un error interno usa el mensaje genérico con el requestId para soporte', () => {
    expect(describeProblem(problem('INTERNAL_ERROR', { status: 500, requestId: '01JABC' }))).toBe(
      `${problemMessage('INTERNAL_ERROR')} Si contactas a soporte, menciona el código 01JABC.`,
    );
  });

  it('WEB-19 un code que el contrato no conoce se muestra como error interno con el requestId', () => {
    const unknown = new ProblemError(500, { code: 'CODIGO_NUEVO', requestId: '01JXYZ' });
    expect(describeProblem(unknown)).toBe(
      `${problemMessage('INTERNAL_ERROR')} Si contactas a soporte, menciona el código 01JXYZ.`,
    );
  });
});

describe('describeError', () => {
  it('WEB-19 usa el mensaje del problema si el error lo trae', () => {
    expect(describeError(new ProblemError(422, { code: 'SAME_ACCOUNT_TRANSFER' }))).toBe(
      problemMessage('SAME_ACCOUNT_TRANSFER'),
    );
  });

  it('WEB-20 sin respuesta del servidor indica revisar la conexión', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe(CONNECTION_ERROR);
    expect(describeError(new NetworkError(new Error('x')))).toBe(CONNECTION_ERROR);
  });
});
