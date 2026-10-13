import { formatMXN, toCents } from '@devchrisvaz/wallet-contract';
import type { Direction } from '@devchrisvaz/wallet-design-tokens';
import { MONEY } from './conventions';

/*
 * Montos como texto (WEB-21): el formato lo da formatMXN del contrato y la aritmética, cuando hace
 * falta, se hace en centavos con BigInt. Nunca parseFloat ni Number (regla de ESLint).
 */

/** Monto con el signo de su dirección: `+$1,500.00` o `−$850.50` (U+2212), según DSG-09. */
export function signedAmount(direction: Direction, amount: string): string {
  const absolute = amount.startsWith('-') ? amount.slice(1) : amount;
  return `${MONEY[direction].sign}${formatMXN(absolute)}`;
}

/** CLABE enmascarada salvo los últimos 4 dígitos: `•••• 9719`. */
export function maskClabe(clabe: string): string {
  return `•••• ${clabe.slice(-4)}`;
}

/** Quita separadores de miles y espacios de un monto capturado; no redondea ni valida. */
export function normalizeAmountInput(value: string): string {
  return value.replace(/[,\s]/g, '');
}

/** Porcentaje entero (0 a 100) de lo usado frente al límite, calculado en centavos con BigInt. */
export function percentUsed(used: string, limit: string): number {
  const usedCents = toCents(used);
  const limitCents = toCents(limit);
  if (limitCents <= 0n || usedCents >= limitCents) return 100;
  const percent = (usedCents * 100n) / limitCents;
  // Entero de 0 a 99 que viene de BigInt: no es un monto, se lee como entero.
  return Number.parseInt(percent.toString(), 10);
}
