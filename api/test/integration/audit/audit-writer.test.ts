import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../../../src/modules/audit/domain/audit-event.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { runWithRequestContext } from '../../../src/platform/context/request-context.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();
const clock = new FakeClock('2026-10-13T18:30:00.000Z');

function writer() {
  return new PgAuditWriter(harness.app, clock);
}

async function auditRows() {
  return harness.migrator.query(
    `SELECT occurred_at, actor_type, actor_user_id, action, entity_type, entity_id, request_id,
            host(ip) AS ip, user_agent, metadata
       FROM app.audit_log ORDER BY id`,
  );
}

const context = { requestId: 'req-audit-1', ip: '203.0.113.7', userAgent: 'vitest/1.0' };

describe('AUD-01 escritor de auditoría', () => {
  it('AUD-01 escribe el evento con requestId, IP y user agent del contexto de la petición', async () => {
    const userId = randomUUID();
    const runner = new TypeormTransactionRunner(harness.app);
    await runWithRequestContext({ ...context }, () =>
      runner.run((tx) =>
        writer().record(tx, {
          action: 'LOGIN_SUCCEEDED',
          actor: { type: 'USER', userId },
          entity: { type: 'user', id: userId },
          metadata: { method: 'password' },
        }),
      ),
    );
    expect(await auditRows()).toEqual([
      {
        occurred_at: new Date('2026-10-13T18:30:00.000Z'),
        actor_type: 'USER',
        actor_user_id: userId,
        action: 'LOGIN_SUCCEEDED',
        entity_type: 'user',
        entity_id: userId,
        request_id: 'req-audit-1',
        ip: '203.0.113.7',
        user_agent: 'vitest/1.0',
        metadata: { method: 'password' },
      },
    ]);
  });

  it('AUD-03 el evento se revierte junto con la transacción de negocio', async () => {
    const runner = new TypeormTransactionRunner(harness.app);
    await expect(
      runner.run(async (tx) => {
        await writer().record(tx, { action: 'EMAIL_VERIFIED', actor: { type: 'SYSTEM' } });
        throw new Error('la operación de negocio falló después de auditar');
      }),
    ).rejects.toThrow('falló');
    expect(await auditRows()).toEqual([]);
  });

  it('AUD-03 la escritura independiente persiste sin transacción de negocio', async () => {
    await runWithRequestContext({ ...context }, () =>
      writer().recordStandalone({
        action: 'LOGIN_FAILED',
        actor: { type: 'ANONYMOUS' },
        metadata: { reason: 'UNKNOWN_EMAIL' },
      }),
    );
    expect(await auditRows()).toMatchObject([
      { action: 'LOGIN_FAILED', actor_type: 'ANONYMOUS', actor_user_id: null },
    ]);
  });

  it('AUD-01 rechaza una acción fuera del catálogo antes de tocar la base', async () => {
    const event = { action: 'MONEY_PRINTED', actor: { type: 'SYSTEM' } } as unknown as AuditEvent;
    await expect(writer().recordStandalone(event)).rejects.toThrow(/MONEY_PRINTED/);
    expect(await auditRows()).toEqual([]);
  });

  it('AUD-02 rechaza cada llave prohibida, en minúsculas, mayúsculas y mixtas', async () => {
    const forbidden = [
      'email',
      'phone',
      'curp',
      'rfc',
      'clabe',
      'fullName',
      'name',
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'code',
      'otp',
    ];
    // Los metadatos solo admiten valores escalares, así que no hay objetos anidados que revisar.
    const variants = forbidden.flatMap((key) => [
      key,
      key.toLowerCase(),
      key.toUpperCase(),
      key.charAt(0).toUpperCase() + key.slice(1),
    ]);
    for (const key of new Set(variants)) {
      await expect(
        writer().recordStandalone({
          action: 'USER_REGISTERED',
          actor: { type: 'SYSTEM' },
          metadata: { [key]: 'valor' },
        }),
      ).rejects.toThrow(key);
    }
    expect(await auditRows()).toEqual([]);
  });

  it('AUD-04 funciona con el rol de ejecución, que no tiene SELECT (sin RETURNING)', async () => {
    const [{ can_select }] = await harness.app.query(
      `SELECT has_table_privilege('app.audit_log', 'SELECT') AS can_select`,
    );
    expect(can_select).toBe(false);
    await writer().recordStandalone({ action: 'LOGOUT', actor: { type: 'SYSTEM' } });
    expect(await auditRows()).toHaveLength(1);
  });
});
