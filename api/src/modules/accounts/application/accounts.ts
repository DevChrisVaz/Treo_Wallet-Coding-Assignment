import type { Transaction } from '../../../shared/transaction.js';
import type { UserAccount } from '../domain/account.js';

/** Persistencia de cuentas. Toda consulta en nombre de un usuario filtra por su dueño (ACC-06). */
export interface AccountRepository {
  /** Siguiente número de cuenta de 11 dígitos (secuencia de la base). */
  nextAccountNumber(tx: Transaction): Promise<bigint>;
  insertUserAccount(tx: Transaction, account: UserAccount): Promise<void>;
}
