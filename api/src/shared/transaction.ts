declare const transactionBrand: unique symbol;

/**
 * Transacción en curso, opaca para el dominio y la aplicación: los casos de uso la reciben del
 * `TransactionRunner` y la pasan a los repositorios y al escritor de auditoría, que son los únicos
 * que saben qué hay dentro. Así la aplicación coordina transacciones sin depender del ORM.
 */
export interface Transaction {
  readonly [transactionBrand]: true;
}

/** Puerto para ejecutar trabajo en una sola transacción: COMMIT si termina, ROLLBACK si lanza. */
export interface TransactionRunner {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
