import { describe, expect, it } from 'vitest';
import {
  StatementReconciliationError,
  StatementSummary,
} from '../../../src/modules/statements/domain/statement-summary.js';

const entry = (amountCents: bigint, balanceAfterCents: bigint) => ({
  amountCents,
  balanceAfterCents,
});

describe('HIS-12 resumen y conciliación del estado de cuenta', () => {
  it('HIS-12 cerró agosto con 1000.00, recibió 500.00 y envió 150.00: el resumen cuadra con el ledger', () => {
    const summary = StatementSummary.open(100_000n);
    summary.add(entry(50_000n, 150_000n));
    summary.add(entry(-15_000n, 135_000n));
    expect(summary.close()).toEqual({
      openingCents: 100_000n,
      creditsCents: 50_000n,
      debitsCents: 15_000n,
      closingCents: 135_000n,
      count: 2,
    });
  });

  it('HIS-12 abonos y cargos se acumulan por separado y los cargos en valor absoluto', () => {
    const summary = StatementSummary.open(0n);
    summary.add(entry(125_050n, 125_050n));
    summary.add(entry(-1n, 125_049n));
    summary.add(entry(1n, 125_050n));
    summary.add(entry(-125_050n, 0n));
    expect(summary.close()).toMatchObject({
      creditsCents: 125_051n,
      debitsCents: 125_051n,
      closingCents: 0n,
      count: 4,
    });
  });

  it('HIS-12 un mes sin movimientos cierra con el saldo inicial y abonos y cargos en cero', () => {
    expect(StatementSummary.open(25_000n).close()).toEqual({
      openingCents: 25_000n,
      creditsCents: 0n,
      debitsCents: 0n,
      closingCents: 25_000n,
      count: 0,
    });
  });

  it('HIS-12 sin movimientos anteriores el saldo inicial es 0.00', () => {
    expect(StatementSummary.open(0n).close().closingCents).toBe(0n);
  });

  it('HIS-12 conserva la precisión de BigInt más allá de Number.MAX_SAFE_INTEGER', () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1
    const summary = StatementSummary.open(big);
    summary.add(entry(1n, big + 1n));
    expect(summary.close()).toMatchObject({ creditsCents: 1n, closingCents: big + 1n });
  });

  it('HIS-12 si el último saldo no es inicial + abonos − cargos, el resumen no cierra (descuadre)', () => {
    const summary = StatementSummary.open(100_000n);
    summary.add(entry(50_000n, 150_000n));
    // El ledger diría 1,350.00; un saldo posterior de 1,300.00 es un descuadre.
    summary.add(entry(-15_000n, 130_000n));
    expect(() => summary.close()).toThrow(StatementReconciliationError);
  });

  it('HIS-12 un renglón repetido también descuadra el resumen', () => {
    const summary = StatementSummary.open(100_000n);
    summary.add(entry(50_000n, 150_000n));
    summary.add(entry(50_000n, 150_000n));
    expect(() => summary.close()).toThrow(StatementReconciliationError);
  });

  it('HIS-12 el error de descuadre no es un error de negocio: lleva las cifras para el log, no para el cliente', () => {
    const summary = StatementSummary.open(10n);
    summary.add(entry(5n, 20n));
    try {
      summary.close();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(StatementReconciliationError);
      expect(error).toMatchObject({
        openingCents: 10n,
        creditsCents: 5n,
        debitsCents: 0n,
        closingCents: 20n,
      });
    }
  });

  it('HIS-12 después de cerrar no se pueden agregar renglones', () => {
    const summary = StatementSummary.open(0n);
    summary.close();
    expect(() => summary.add(entry(1n, 1n))).toThrow();
  });
});
