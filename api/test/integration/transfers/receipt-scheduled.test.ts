import { beforeEach, describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared/money.js';
import { seedDemoData } from '../../../src/seed/demo-data.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;
let anaEmail: string;

const OCT_14_NOON = '2026-10-14T18:00:00.000Z';
/** 00:00:30 del 15 de octubre en la Ciudad de México. */
const OCT_15_RUN = '2026-10-15T06:00:30.000Z';
const SUBJECT = 'Transferencia realizada';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: OCT_14_NOON });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  anaEmail = ana.person.email.trim().toLowerCase();
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

async function schedule(
  amount: string,
  destination: Record<string, unknown> = { type: 'BENEFICIARY', beneficiaryId },
) {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination,
    amount,
    concept: 'Renta',
    reference: '1',
    scheduledFor: '2026-10-15T06:00:00.000Z',
  });
  expect(res.status).toBe(201);
  t.mailer.clear();
  return res.body.id as string;
}

async function runAt(time: string) {
  t.clock.set(time);
  const summary = await t.container.scheduler.runner.runOnce();
  await t.container.notices.drain(2_000);
  return summary;
}

const receipts = (to = anaEmail) => t.mailer.to(to).filter((m) => m.subject === SUBJECT);

describe('TRF-38 comprobante de una programada ejecutada', () => {
  it('TRF-38 al ejecutarla el ejecutor envía un solo comprobante con la fecha de la ejecución', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    const summary = await runAt(OCT_15_RUN);
    expect(summary).toMatchObject({ completed: 1, failed: 0 });
    const [mail, ...rest] = receipts();
    expect(rest).toHaveLength(0);
    expect(mail?.text).toContain('$1,000.00');
    expect(mail?.text).toContain('15 de octubre de 2026, 00:00');
    expect(mail?.text).toContain(id);
    expect(mail?.text).not.toContain(luis.principal.clabe);
    expect(t.mailer.to(luis.person.email.trim().toLowerCase())).toHaveLength(0);
  });

  it('TRF-38 una segunda pasada no vuelve a enviar el comprobante', async () => {
    await fund(t, ana.principal.id, '5000.00');
    await schedule('1000.00');
    await runAt(OCT_15_RUN);
    await runAt('2026-10-15T06:05:00.000Z');
    expect(receipts()).toHaveLength(1);
  });

  it('TRF-38 una programada que falla por saldo envía el aviso de falla y ningún comprobante', async () => {
    await schedule('1000.00');
    const summary = await runAt(OCT_15_RUN);
    expect(summary).toMatchObject({ completed: 0, failed: 1 });
    expect(receipts()).toHaveLength(0);
    expect(t.mailer.to(anaEmail).map((m) => m.subject)).toEqual([
      'Tu transferencia programada no se realizó',
    ]);
  });

  it('TRF-38 una programada entre cuentas propias no envía comprobante', async () => {
    await fund(t, ana.principal.id, '5000.00');
    await schedule('500.00', { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id });
    const summary = await runAt(OCT_15_RUN);
    expect(summary.completed).toBe(1);
    expect(receipts()).toHaveLength(0);
  });

  it('PLT-16 con el servidor de correo caído la programada se completa igual', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const id = await schedule('1000.00');
    t.mailer.down = true;
    const summary = await runAt(OCT_15_RUN);
    expect(summary).toMatchObject({ completed: 1, errors: 0 });
    const [row] = await harness.migrator.query(`SELECT status FROM app.transfers WHERE id = $1`, [
      id,
    ]);
    expect(row.status).toBe('COMPLETED');
  });
});

describe('TRF-38 el seed y el fondeo no envían correos', () => {
  it('TRF-38 sembrar los datos demo y fondear una cuenta no envía ningún correo', async () => {
    t.mailer.clear();
    await seedDemoData(harness.migrator, {
      clabe: { bankCode: '999', plazaCode: '180' },
      generatedUsers: 2,
      fundedAt: new Date('2025-10-11T15:00:00.000Z'),
    });
    await t.container.ledger.fundAccount.execute({
      account: ana.principal.id,
      amount: Money.parse('100.00'),
    });
    await t.container.notices.drain(2_000);
    expect(t.mailer.sent).toHaveLength(0);
  });
});
