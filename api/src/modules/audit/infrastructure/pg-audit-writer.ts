import type { DataSource } from 'typeorm';
import { currentRequestContext } from '../../../platform/context/request-context.js';
import { queryRunnerOf } from '../../../platform/persistence/transaction.js';
import type { Clock } from '../../../shared/clock.js';
import type { Transaction } from '../../../shared/transaction.js';
import type { AuditWriter } from '../application/audit-writer.js';
import { assertValidAuditEvent, type AuditEvent } from '../domain/audit-event.js';

/**
 * Sin `RETURNING`: el rol de ejecución solo tiene INSERT sobre la bitácora (AUD-04).
 */
const INSERT = `
  INSERT INTO audit_log (occurred_at, actor_type, actor_user_id, action, entity_type, entity_id,
                         request_id, ip, user_agent, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

/** Escritor de la bitácora sobre PostgreSQL; toma `requestId`, IP y user agent del contexto. */
export class PgAuditWriter implements AuditWriter {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  async record(tx: Transaction, event: AuditEvent): Promise<void> {
    assertValidAuditEvent(event);
    await queryRunnerOf(tx).query(INSERT, this.parameters(event));
  }

  async recordStandalone(event: AuditEvent): Promise<void> {
    assertValidAuditEvent(event);
    await this.dataSource.query(INSERT, this.parameters(event));
  }

  private parameters(event: AuditEvent): unknown[] {
    const context = currentRequestContext();
    return [
      this.clock.now(),
      event.actor.type,
      event.actor.type === 'USER' ? event.actor.userId : null,
      event.action,
      event.entity?.type ?? null,
      event.entity?.id ?? null,
      context?.requestId ?? null,
      context?.ip ?? null,
      context?.userAgent?.slice(0, 512) ?? null,
      JSON.stringify(event.metadata ?? {}),
    ];
  }
}
