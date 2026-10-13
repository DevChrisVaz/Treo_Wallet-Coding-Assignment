/** Las dos cuentas que recibe cada usuario al verificar su correo (ACC-04), en este orden. */
export const DEFAULT_ACCOUNT_NAMES = ['Principal', 'Ahorro'] as const;

export type AccountType = 'USER' | 'SYSTEM';

/** Cuenta de un usuario. El saldo está en centavos, como `bigint` (nunca `number`). */
export interface UserAccount {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly clabe: string;
  readonly balanceCents: bigint;
  readonly createdAt: Date;
}
