import { describe, expect, it } from 'vitest';
import {
  heroAmountSize,
  money,
  movementType,
  resolveToken,
  splitCents,
  theme,
  transferStatus,
} from '../src/index';

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

  it.each([
    ['SCHEDULED', 'info', 'Programada'],
    ['CANCELLED', 'neutral', 'Cancelada'],
  ] as const)('DSG-18 %s → tono %s, "%s"', (status, tone, label) => {
    expect(transferStatus[status]).toEqual({ tone, label });
  });

  it('DSG-18 cubre los siete valores de TransferStatus del contrato 1.2.0', () => {
    // Escritos a mano: el paquete no depende del contrato.
    const contractStatuses = [
      'PENDING_OTP',
      'COMPLETED',
      'REJECTED',
      'FAILED',
      'EXPIRED',
      'SCHEDULED',
      'CANCELLED',
    ];
    expect(Object.keys(transferStatus).sort()).toEqual(contractStatuses.sort());
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

describe('monto del hero', () => {
  it.each([
    ['$35,000.00', 'displayXl'],
    ['$350,000.00', 'displayXl'],
    ['$3,500,000.00', 'display'],
    ['$35,000,000.00', 'display'],
    ['$1,234,567,890.00', 'h1'],
  ] as const)('DSG-13 %s usa %s para caber en una línea a 390 px', (formatted, size) => {
    expect(heroAmountSize(formatted)).toBe(size);
  });

  it('DSG-13 splitCents separa los centavos para mostrarlos más chicos', () => {
    expect(splitCents('$35,000.00')).toEqual(['$35,000', '.00']);
  });
});
