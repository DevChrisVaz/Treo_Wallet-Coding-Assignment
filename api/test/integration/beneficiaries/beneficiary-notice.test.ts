import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let email: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  email = ana.person.email.trim().toLowerCase();
  t.mailer.clear();
});

async function add(body: Record<string, unknown>) {
  const res = await authed(t, ana.accessToken).post('/beneficiaries').send(body);
  await t.container.notices.drain(2_000);
  return res;
}

const notices = () => t.mailer.to(email).filter((m) => m.subject.startsWith('Agregaste a '));
const luisBody = () => ({ name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe });

describe('BEN-12 aviso del alta de un beneficiario', () => {
  it('BEN-12 el alta (201) envía un solo aviso con nombre, alias, terminación de la CLABE y fecha', async () => {
    const res = await add(luisBody());
    expect(res.status).toBe(201);
    const [mail, ...rest] = notices();
    expect(rest).toHaveLength(0);
    expect(mail?.subject).toBe('Agregaste a Luis como beneficiario');
    expect(mail?.text).toContain('Luis Pérez');
    expect(mail?.text).toContain(`terminación ${luis.principal.clabe.slice(-4)}`);
    expect(mail?.text).toContain('13 de octubre de 2026, 12:00');
    expect(mail?.text).toMatch(/responde este correo/);
    for (const part of [mail?.text, mail?.html, mail?.subject]) {
      expect(part).not.toContain(luis.principal.clabe);
    }
  });

  it('BEN-12 el alias y el nombre se escapan en el HTML', async () => {
    const res = await add({ ...luisBody(), name: '<b>Luis</b> & Co', alias: 'L<i>' });
    expect(res.status).toBe(201);
    const mail = notices()[0];
    expect(mail?.html).not.toContain('<b>Luis</b>');
    expect(mail?.html).toContain('&lt;b&gt;Luis&lt;/b&gt; &amp; Co');
  });

  it('BEN-12 la repetición idéntica (200) no envía otro aviso', async () => {
    await add(luisBody());
    const again = await add(luisBody());
    expect(again.status).toBe(200);
    expect(notices()).toHaveLength(1);
  });

  it('BEN-12 un conflicto (409) y un dato inválido (422) no envían aviso', async () => {
    await add(luisBody());
    t.mailer.clear();
    const conflict = await add({ ...luisBody(), name: 'Otro Nombre' });
    expect(conflict.status).toBe(409);
    const invalid = await add({ ...luisBody(), clabe: '123' });
    expect(invalid.status).toBe(422);
    expect(notices()).toHaveLength(0);
  });

  it('BEN-12 con el servidor de correo caído el alta responde 201 con el mismo cuerpo', async () => {
    t.mailer.down = true;
    const res = await add(luisBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...luisBody(), id: expect.any(String) });
    expect(t.logs.entries().some((entry) => entry.template === 'beneficiary-notice')).toBe(true);
  });
});
