import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { buildClabe } from '../../../src/modules/accounts/domain/clabe.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

async function create(owner: LedgerUser, body: Record<string, unknown>) {
  const res = await authed(t, owner.accessToken).post('/beneficiaries').send(body);
  expectToMatchContract(res, 'createBeneficiary');
  return res;
}

function wrongCheckDigit(clabe: string): string {
  return `${clabe.slice(0, 17)}${(Number(clabe[17]) + 1) % 10}`;
}

describe('BEN-02 a BEN-05 validaciones del alta', () => {
  it.each([
    ['una CLABE de 17 dígitos', () => '03218000011835971', 422, 'VALIDATION_FAILED'],
    ['una CLABE como número JSON', () => 2180000118359719, 422, 'VALIDATION_FAILED'],
    ['un dígito verificador incorrecto', () => '032180000118359718', 422, 'CLABE_INVALID'],
    ['una CLABE válida de otro banco', () => '032180000118359719', 422, 'CLABE_NOT_IN_PLATFORM'],
    [
      'una CLABE de la plataforma sin cuenta',
      () => buildClabe({ bankCode: '999', plazaCode: '180', accountNumber: 99_999_999_999n }),
      422,
      'CLABE_NOT_IN_PLATFORM',
    ],
    [
      'la CLABE de su propia cuenta de Ahorro',
      () => ana.ahorro.clabe,
      422,
      'BENEFICIARY_IS_OWN_ACCOUNT',
    ],
  ])('BEN-03 %s responde %i %s', async (_case, clabe, status, code) => {
    const res = await create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: clabe() });
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });

  it('BEN-02 la CLABE de 17 dígitos se señala en /clabe', async () => {
    const res = await create(ana, { name: 'Luis', alias: 'Luis', clabe: '03218000011835971' });
    expect(res.body.errors).toEqual([expect.objectContaining({ pointer: '/clabe' })]);
  });

  it('BEN-06 una CLABE propia con verificador incorrecto es CLABE_INVALID', async () => {
    const res = await create(ana, {
      name: 'Yo',
      alias: 'Yo',
      clabe: wrongCheckDigit(ana.ahorro.clabe),
    });
    expect(res.body.code).toBe('CLABE_INVALID');
  });
});

describe('BEN-07 idempotencia por contenido y conflictos', () => {
  it('BEN-07 la misma CLABE con otro alias responde 409 BENEFICIARY_CONFLICT', async () => {
    await create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe });
    const res = await create(ana, {
      name: 'Luis Pérez',
      alias: 'Luisito',
      clabe: luis.principal.clabe,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BENEFICIARY_CONFLICT');
  });

  it('BEN-07 un alias repetido con otra CLABE responde 409 BENEFICIARY_CONFLICT', async () => {
    await create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe });
    const res = await create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: luis.ahorro.clabe });
    expect(res.status).toBe(409);
  });

  it('BEN-08 dos altas simultáneas de la misma CLABE con datos distintos: una 201 y otra 409', async () => {
    const responses = await Promise.all([
      create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe }),
      create(ana, { name: 'Luis P.', alias: 'Primo', clabe: luis.principal.clabe }),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.beneficiaries WHERE user_id = $1',
      [ana.userId],
    );
    expect(n).toBe(1);
  });
});

describe('BEN-09 listado aislado por usuario', () => {
  it('BEN-09 Ana solo ve sus beneficiarios', async () => {
    await create(ana, { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe });
    await create(luis, { name: 'Ana Gómez', alias: 'Ana', clabe: ana.principal.clabe });
    const list = await authed(t, ana.accessToken).get('/beneficiaries');
    expect(list.body.items.map((item: { alias: string }) => item.alias)).toEqual(['Luis']);
  });
});

describe('BEN-11 auditoría del alta', () => {
  it('BEN-11 el alta deja BENEFICIARY_CREATED con los ids y sin CLABE ni nombre; el reintento no audita', async () => {
    const body = { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe };
    const created = await create(ana, body);
    await create(ana, body);
    const events = (await auditEvents(harness.migrator)).filter(
      (event) => event.action === 'BENEFICIARY_CREATED',
    );
    expect(events).toMatchObject([
      { actor_type: 'USER', actor_user_id: ana.userId, entity_id: created.body.id },
    ]);
    expect(leakedValues(events, [body.clabe, body.name, body.alias])).toEqual([]);
  });
});

describe('BEN-11 el alta se revierte si falla la auditoría', () => {
  it('BEN-11 si falla BENEFICIARY_CREATED no queda el beneficiario y el alta se puede reintentar', async () => {
    // Misma transacción: si la escritura del evento falla, el INSERT del beneficiario se deshace.
    let failing = true;
    const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
    const audit: AuditWriter = {
      record: async (tx, event) => {
        if (failing && event.action === 'BENEFICIARY_CREATED') {
          throw new Error('falla forzada de auditoría');
        }
        return real.record(tx, event);
      },
      recordStandalone: (event) => real.recordStandalone(event),
    };
    t = await buildTestApp(harness, { overrides: { audit } });
    const body = { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe };

    const failed = await create(ana, body);
    expect(failed.status).toBe(500);
    expect(failed.body.code).toBe('INTERNAL_ERROR');
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.beneficiaries WHERE user_id = $1',
      [ana.userId],
    );
    expect(n).toBe(0);
    expect(
      (await auditEvents(harness.migrator)).filter((e) => e.action === 'BENEFICIARY_CREATED'),
    ).toEqual([]);
    const list = await authed(t, ana.accessToken).get('/beneficiaries');
    expect(list.body.items).toEqual([]);

    // Sin la falla, el mismo alta se crea (201), no queda atascada como existente.
    failing = false;
    const retry = await create(ana, body);
    expect(retry.status).toBe(201);
  });
});
