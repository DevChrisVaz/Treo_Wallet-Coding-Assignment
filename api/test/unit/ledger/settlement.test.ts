import { describe, expect, it } from 'vitest';
import { declineFor } from '../../../src/modules/transfers/domain/settlement.js';
import { Money } from '../../../src/shared/money.js';

const m = (amount: string) => Money.parse(amount);
const limit = (used: string) => ({
  used: used === '0' ? Money.ZERO : m(used),
  limit: m('50000.00'),
});

describe('TRF-30 validación de una transferencia ya bloqueada', () => {
  it('TRF-10 sin saldo suficiente es INSUFFICIENT_FUNDS', () => {
    expect(declineFor({ balance: m('500.00'), amount: m('1000.00'), usage: null })).toEqual({
      reason: 'INSUFFICIENT_FUNDS',
      remaining: null,
    });
  });

  it('TRF-10 con el saldo exacto pasa', () => {
    expect(declineFor({ balance: m('1000.00'), amount: m('1000.00'), usage: null })).toBeNull();
  });

  it('TRF-11 a un tercero que excede el límite del día es DAILY_LIMIT_EXCEEDED con lo que queda', () => {
    const decline = declineFor({
      balance: m('10000.00'),
      amount: m('6000.00'),
      usage: limit('45000.00'),
    });
    expect(decline?.reason).toBe('DAILY_LIMIT_EXCEEDED');
    expect(decline?.remaining?.toDecimalString()).toBe('5000.00');
  });

  it('TRF-11 llegar exactamente al límite pasa', () => {
    expect(
      declineFor({ balance: m('10000.00'), amount: m('5000.00'), usage: limit('45000.00') }),
    ).toBeNull();
  });

  it('TRF-10 el saldo se revisa antes que el límite', () => {
    expect(
      declineFor({ balance: m('100.00'), amount: m('6000.00'), usage: limit('45000.00') })?.reason,
    ).toBe('INSUFFICIENT_FUNDS');
  });

  it('TRF-11 sin contador (cuentas propias) el límite no aplica', () => {
    expect(declineFor({ balance: m('90000.00'), amount: m('80000.00'), usage: null })).toBeNull();
  });
});
