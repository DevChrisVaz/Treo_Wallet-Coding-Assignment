import { NetworkError, PROBLEM_CODES, ProblemError } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';

import { errorMessage } from '../errors';

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new ProblemError(status, {
    type: '/problems/x',
    title: 'Insufficient funds in ledger account',
    detail: 'SELECT balance FROM accounts WHERE id = $1 FOR UPDATE',
    code,
    requestId: 'req-7f3a',
    ...extra,
  });

describe('mensajes de error por code', () => {
  test('MOB-14 saldo insuficiente usa el mensaje del paquete de diseño', () => {
    expect(errorMessage(problem(422, 'INSUFFICIENT_FUNDS'))).toBe(
      'No tienes saldo suficiente para esta transferencia.',
    );
  });

  test('MOB-14 límite diario excedido agrega lo que queda hoy con formatMXN', () => {
    expect(errorMessage(problem(422, 'DAILY_LIMIT_EXCEEDED', { remaining: '5000.00' }))).toBe(
      'Esta transferencia supera lo que te queda del límite de hoy. Hoy te quedan $5,000.00.',
    );
  });

  test('MOB-14 un error interno muestra un mensaje genérico con el requestId y sin detalles técnicos', () => {
    const message = errorMessage(problem(500, 'INTERNAL_ERROR'));
    expect(message).toBe(
      'Algo falló de nuestro lado. Intenta de nuevo en unos minutos. Folio para soporte: req-7f3a.',
    );
    expect(message).not.toMatch(/SELECT|ledger|Insufficient/);
  });

  test('MOB-14 un code desconocido se trata como error interno, con el requestId', () => {
    expect(errorMessage(problem(418, 'TEAPOT_OVERHEATED'))).toBe(
      'Algo falló de nuestro lado. Intenta de nuevo en unos minutos. Folio para soporte: req-7f3a.',
    );
  });

  test.each([
    ['TRANSFER_NOT_CANCELLABLE', 409, 'Esta transferencia ya no se puede cancelar.'],
    [
      'SCHEDULED_LIMIT_REACHED',
      422,
      'Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra.',
    ],
  ])(
    'MOB-14 %s (%s, contrato 1.2.0) usa el mensaje del paquete de diseño',
    (code, status, text) => {
      expect(errorMessage(problem(status, code))).toBe(text);
    },
  );

  test('MOB-14 el mensaje nunca sale de type, title ni detail', () => {
    for (const code of PROBLEM_CODES) {
      const message = errorMessage(problem(422, code));
      expect(message).not.toContain('Insufficient funds in ledger account');
      expect(message).not.toContain('SELECT');
      expect(message.startsWith(problemMessage(code))).toBe(true);
    }
  });

  test('MOB-12 un código incorrecto agrega los intentos que quedan', () => {
    expect(errorMessage(problem(422, 'OTP_INVALID', { attemptsRemaining: 1 }))).toBe(
      'El código no es correcto. Te queda 1 intento.',
    );
    expect(errorMessage(problem(422, 'OTP_INVALID', { attemptsRemaining: 2 }))).toBe(
      'El código no es correcto. Te quedan 2 intentos.',
    );
  });

  test('MOB-10 sin respuesta de la API explica que no hubo conexión', () => {
    expect(errorMessage(new NetworkError(new TypeError('Network request failed')))).toBe(
      'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.',
    );
  });

  test('MOB-14 un error inesperado de la app no muestra su mensaje técnico', () => {
    expect(errorMessage(new Error('undefined is not a function'))).toBe(
      problemMessage('INTERNAL_ERROR'),
    );
  });
});
