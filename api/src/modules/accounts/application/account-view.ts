import type { Account } from '@devchrisvaz/wallet-contract';
import { Money } from '../../../shared/money.js';
import type { UserAccount } from '../domain/account.js';

/** Cuenta del contrato: saldo como string con 2 decimales y moneda MXN (ACC-10). */
export function toAccountView(account: UserAccount): Account {
  return {
    id: account.id,
    name: account.name,
    clabe: account.clabe,
    balance: Money.fromCents(account.balanceCents).toDecimalString(),
    currency: 'MXN',
    createdAt: account.createdAt.toISOString(),
  };
}
