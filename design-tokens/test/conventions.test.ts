import { describe, expect, it } from 'vitest';
import { money, movementType, resolveToken, theme, transferStatus } from '../src/index';

describe('estados de transferencia', () => {
  it.each([
    ['PENDING_OTP', 'warning', 'Pendiente de código'],
    ['COMPLETED', 'success', 'Completada'],
    ['REJECTED', 'danger', 'Rechazada'],
    ['FAILED', 'danger', 'Fallida'],
    ['EXPIRED', 'neutral', 'Vencida'],
  ] as const)('DSG-10 %s → tono %s, "%s"', (status, tone, label) => {
    expect(transferStatus[status]).toEqual({ tone, label });
  });
});

describe('tipos de movimiento', () => {
  it.each([
    ['DEPOSIT', 'in', 'Depósito'],
    ['TRANSFER_IN', 'in', 'Transferencia recibida'],
    ['TRANSFER_OUT', 'out', 'Transferencia enviada'],
    ['OWN_TRANSFER_IN', 'in', 'Traspaso recibido'],
    ['OWN_TRANSFER_OUT', 'out', 'Traspaso enviado'],
  ] as const)('DSG-10 %s → %s, "%s"', (type, direction, label) => {
    expect(movementType[type]).toEqual({ direction, label });
  });
});

describe('convención de dinero', () => {
  it('DSG-09 una entrada lleva "+" y el color de dinero entrante', () => {
    expect(money.in.sign).toBe('+');
    expect(resolveToken(theme, money.in.color)).toBe(theme.colors.money.in);
  });

  it('DSG-09 una salida lleva el signo menos U+2212, no un guion', () => {
    expect(money.out.sign).toBe('−');
    expect(money.out.sign).not.toBe('-');
  });

  it('DSG-09 una salida usa la tinta, nunca el color de error', () => {
    const outColor = resolveToken(theme, money.out.color);
    expect(outColor).toBe(theme.colors.text.primary);
    expect(outColor).not.toBe(theme.colors.status.danger.fg);
  });
});
