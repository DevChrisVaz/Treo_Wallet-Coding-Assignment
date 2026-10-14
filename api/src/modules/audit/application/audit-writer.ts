import type { Transaction } from '../../../shared/transaction.js';
import type { AuditEvent } from '../domain/audit-event.js';

/** Puerto de la bitácora de auditoría (AUD-01, AUD-03). */
export interface AuditWriter {
  /**
   * Escribe el evento en la transacción de negocio en curso: si el evento no se puede escribir,
   * la operación entera se revierte.
   */
  record(tx: Transaction, event: AuditEvent): Promise<void>;
  /** Escribe un evento que no acompaña un cambio de negocio (por ejemplo `LOGIN_FAILED`). */
  recordStandalone(event: AuditEvent): Promise<void>;
}
