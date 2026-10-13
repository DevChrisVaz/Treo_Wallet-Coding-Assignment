import type { DataSource } from 'typeorm';

export interface AuditRow {
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  request_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
}

/** Eventos de la bitácora en orden de escritura (con el rol dueño: el de ejecución no puede leer). */
export async function auditEvents(migrator: DataSource): Promise<AuditRow[]> {
  return migrator.query(
    `SELECT actor_type, actor_user_id, action, entity_type, entity_id, request_id, host(ip) AS ip,
            user_agent, metadata
       FROM app.audit_log ORDER BY id`,
  );
}

/**
 * Valores que aparecen en algún campo de algún evento (AUD-02). Se buscan en la fila completa
 * serializada, sin importar mayúsculas, para no depender de en qué columna quedarían.
 */
export function leakedValues(rows: readonly AuditRow[], values: readonly string[]): string[] {
  const text = JSON.stringify(rows).toLowerCase();
  return values.filter((value) => text.includes(value.toLowerCase()));
}
