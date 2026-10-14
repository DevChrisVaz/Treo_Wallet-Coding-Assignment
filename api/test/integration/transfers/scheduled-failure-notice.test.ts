import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MailMessage } from '../../../src/platform/mail/mailer.js';
import { SmtpMailer } from '../../../src/platform/mail/smtp-mailer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { InMemoryMailer } from '../../helpers/in-memory-mailer.js';
import {
  addBeneficiary,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { clearMailbox, messagesTo, smtpHost, smtpPort } from '../../helpers/mailpit.js';

const harness = useIntegrationHarness();
const OCT_14_NOON = '2026-10-14T18:00:00.000Z';
const OCT_15_RUN = '2026-10-15T06:00:30.000Z';
const SUBJECT = 'Tu transferencia programada no se realizó';

let setup: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;
let smtp: SmtpMailer | undefined;

/**
 * Los usuarios y la programada se preparan con el correo en memoria (para leer los códigos de
 * verificación); el ejecutor corre en otra instancia de la API sobre la misma base con el correo que
 * cada prueba necesita.
 */
beforeEach(async () => {
  setup = await buildTestApp(harness, { now: OCT_14_NOON });
  ana = await ledgerUser(setup, harness);
  luis = await ledgerUser(setup, harness);
  beneficiaryId = await addBeneficiary(setup, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

afterEach(() => {
  smtp?.close();
  smtp = undefined;
});

async function scheduleToLuis(amount: string) {
  const res = await postTransfer(setup, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Renta',
    reference: '1',
    scheduledFor: '2026-10-15',
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function runnerWith(mailer: TestApp['mailer'] | SmtpMailer): Promise<TestApp> {
  return buildTestApp(harness, { now: OCT_15_RUN, overrides: { mailer } });
}

async function statusOf(id: string): Promise<string> {
  const [row] = await harness.migrator.query(`SELECT status FROM app.transfers WHERE id = $1`, [
    id,
  ]);
  return row.status;
}

/** Un puerto local donde nadie escucha: el servidor SMTP caído. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('TRF-35 aviso de falla de una programada', () => {
  it('TRF-35 por saldo insuficiente, Ana recibe "$1,000.00", "Luis", los 4 dígitos, la fecha y "saldo insuficiente"', async () => {
    await fund(setup, ana.principal.id, '10.00');
    await scheduleToLuis('1000.00');
    const mailer = new InMemoryMailer();
    const t = await runnerWith(mailer);

    await t.container.scheduler.runner.runOnce();

    const [notice] = mailer.to(ana.person.email.toLowerCase());
    expect(notice?.subject).toBe(SUBJECT);
    for (const body of [notice?.text, notice?.html]) {
      expect(body).toContain('$1,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain(luis.principal.clabe.slice(-4));
      expect(body).not.toContain(luis.principal.clabe);
      expect(body).toContain('15 de octubre de 2026');
      expect(body).toContain('saldo insuficiente');
    }
  });

  it('TRF-35 por límite diario, el motivo es "se alcanzó el límite diario de transferencias"', async () => {
    await fund(setup, ana.principal.id, '10000.00');
    await scheduleToLuis('6000.00');
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-15', 4500000, 5000000)`,
      [ana.userId],
    );
    const mailer = new InMemoryMailer();
    const t = await runnerWith(mailer);

    await t.container.scheduler.runner.runOnce();

    expect(mailer.to(ana.person.email.toLowerCase()).at(-1)?.text).toContain(
      'se alcanzó el límite diario de transferencias',
    );
  });

  it('TRF-35 el aviso sale después del COMMIT: al enviarlo, otra conexión ya ve la transferencia FAILED', async () => {
    await fund(setup, ana.principal.id, '10.00');
    const id = await scheduleToLuis('1000.00');
    const seen: string[] = [];
    const mailer = new InMemoryMailer();
    const observing = {
      send: async (message: MailMessage) => {
        seen.push(await statusOf(id));
        await mailer.send(message);
      },
    };
    const t = await runnerWith(observing as unknown as InMemoryMailer);

    await t.container.scheduler.runner.runOnce();

    expect(seen).toEqual(['FAILED']);
  });

  it('TRF-35 una programada que se completa no envía aviso', async () => {
    await fund(setup, ana.principal.id, '5000.00');
    await scheduleToLuis('1000.00');
    const mailer = new InMemoryMailer();
    const t = await runnerWith(mailer);

    await t.container.scheduler.runner.runOnce();

    expect(mailer.sent).toEqual([]);
  });

  it('TRF-35 en Mailpit: el buzón de Ana recibe el aviso con el detalle', async () => {
    await clearMailbox();
    await fund(setup, ana.principal.id, '10.00');
    await scheduleToLuis('1000.00');
    smtp = new SmtpMailer({
      host: smtpHost,
      port: smtpPort,
      from: 'Billetera <no-reply@wallet.local>',
    });
    const t = await runnerWith(smtp);

    await t.container.scheduler.runner.runOnce();

    const inbox = await messagesTo(ana.person.email);
    const notice = inbox.find((message) => message.subject === SUBJECT);
    if (!notice) throw new Error('No llegó el aviso de falla a Mailpit');
    for (const body of [notice.text, notice.html]) {
      expect(body).toContain('$1,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain(luis.principal.clabe.slice(-4));
      expect(body).toContain('15 de octubre de 2026');
      expect(body).toContain('saldo insuficiente');
    }
  });

  it('TRF-35 con el SMTP caído la transferencia queda FAILED, se registra un WARN y la siguiente pasada no la repite', async () => {
    await fund(setup, ana.principal.id, '10.00');
    const id = await scheduleToLuis('1000.00');
    smtp = new SmtpMailer({
      host: '127.0.0.1',
      port: await closedPort(),
      from: 'Billetera <no-reply@wallet.local>',
    });
    const t = await runnerWith(smtp);

    const first = await t.container.scheduler.runner.runOnce();
    t.clock.advance(60_000);
    const second = await t.container.scheduler.runner.runOnce();

    expect(first).toEqual({ completed: 0, failed: 1, skipped: 0, errors: 0 });
    expect(second).toEqual({ completed: 0, failed: 0, skipped: 0, errors: 0 });
    expect(await statusOf(id)).toBe('FAILED');
    const executions = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === id && event.action === 'TRANSFER_FAILED',
    );
    expect(executions).toHaveLength(1);
    const warning = t.logs.entries().find((entry) => entry.msg === 'mail delivery failed');
    expect(warning).toMatchObject({
      level: 'warn',
      template: 'scheduled-transfer-failed',
      transferId: id,
    });
    expect(t.logs.text()).not.toContain(ana.person.email.toLowerCase());
  });

  it('TRF-35 si el aviso lanza un error (no lee la transferencia), se registra un WARN y la pasada sigue con las demás', async () => {
    await fund(setup, ana.principal.id, '100.00');
    const failing = [await scheduleToLuis('1000.00'), await scheduleToLuis('2000.00')];
    const passing = await scheduleToLuis('50.00');
    // La lectura del detalle para armar el aviso falla (no el envío del correo).
    let armed = false;
    const dataSource = new Proxy(harness.app, {
      get(target, prop) {
        if (prop === 'query') {
          return (sql: string, params?: unknown[]) => {
            if (armed && sql.includes('owner_email')) throw new Error('falla forzada de lectura');
            return target.query(sql, params);
          };
        }
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const mailer = new InMemoryMailer();
    const t = await buildTestApp(harness, {
      now: OCT_15_RUN,
      overrides: { mailer, dataSource },
    });
    armed = true;

    const pass = await t.container.scheduler.runner.runOnce();

    expect(pass).toEqual({ completed: 1, failed: 2, skipped: 0, errors: 0 });
    for (const id of failing) expect(await statusOf(id)).toBe('FAILED');
    expect(await statusOf(passing)).toBe('COMPLETED');
    expect(mailer.sent).toEqual([]);
    const warnings = t.logs
      .entries()
      .filter((entry) => entry.msg === 'scheduled transfer failure notice failed');
    expect(warnings.map((entry) => entry.transferId).sort()).toEqual([...failing].sort());
    expect(warnings[0]).toMatchObject({ level: 'warn' });
    expect(t.logs.text()).not.toContain(ana.person.email.toLowerCase());
  });
});
