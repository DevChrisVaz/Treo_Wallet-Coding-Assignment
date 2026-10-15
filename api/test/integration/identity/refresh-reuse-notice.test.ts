import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgUserRepository } from '../../../src/modules/identity/infrastructure/pg-user-repository.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser, type VerifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
let user: VerifiedUser;
let email: string;

const SUBJECT = 'Cerramos una sesión por seguridad';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  user = await verifiedUser(t);
  email = user.person.email.trim().toLowerCase();
  t.mailer.clear();
});

async function refresh(refreshToken: string) {
  const res = await request(t.app).post('/auth/refresh').send({ refreshToken });
  await t.container.notices.drain(2_000);
  return res;
}

function notices() {
  return t.mailer.to(email).filter((message) => message.subject === SUBJECT);
}

/** Un token ya usado, fuera de la ventana de gracia: su reuso revoca la familia. */
async function reusedToken() {
  const first = await refresh(user.refreshToken);
  expect(first.status).toBe(200);
  t.clock.advance(31_000);
  return user.refreshToken;
}

describe('IDN-19 aviso de sesión cerrada por seguridad', () => {
  it('IDN-19 el reuso de un refresh token envía un solo aviso al dueño, sin tokens', async () => {
    const stale = await reusedToken();
    const res = await refresh(stale);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
    const [mail, ...rest] = notices();
    expect(rest).toHaveLength(0);
    expect(mail?.text).toContain('13 de octubre de 2026, 12:00');
    expect(mail?.text).toMatch(/inicia sesión de nuevo/i);
    expect(mail?.text).toMatch(/responde este correo/i);
    for (const part of [mail?.text, mail?.html, mail?.subject]) {
      expect(part).not.toContain(stale);
    }
  });

  it('IDN-19 el mismo token otra vez ya no envía otro aviso', async () => {
    const stale = await reusedToken();
    await refresh(stale);
    const again = await refresh(stale);
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('SESSION_REVOKED');
    expect(notices()).toHaveLength(1);
  });

  it('IDN-19 el reintento dentro de la ventana de gracia no envía aviso', async () => {
    await refresh(user.refreshToken);
    t.clock.advance(3_000);
    const retry = await refresh(user.refreshToken);
    expect(retry.status).toBe(200);
    expect(notices()).toHaveLength(0);
  });

  it('IDN-19 un token desconocido no envía aviso', async () => {
    const res = await refresh('x'.repeat(43));
    expect(res.status).toBe(401);
    expect(notices()).toHaveLength(0);
  });

  it('IDN-19 un token vencido no envía aviso', async () => {
    t.clock.advance(31 * 24 * 60 * 60_000);
    const res = await refresh(user.refreshToken);
    expect(res.status).toBe(401);
    expect(notices()).toHaveLength(0);
  });

  it('PLT-16 con el servidor de correo caído el reuso responde 401 SESSION_REVOKED igual', async () => {
    const stale = await reusedToken();
    t.mailer.down = true;
    const res = await refresh(stale);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
    expect(t.logs.entries().some((entry) => entry.template === 'session-closed-notice')).toBe(true);
  });

  describe('con la lectura del dueño caída después del COMMIT', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('PLT-16 IDN-19 el reuso responde 401 SESSION_REVOKED, la familia queda revocada, no envía nada y solo se registra', async () => {
      const stale = await reusedToken();
      vi.spyOn(PgUserRepository.prototype, 'findById').mockRejectedValue(
        new Error('connection terminated'),
      );
      const res = await refresh(stale);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('SESSION_REVOKED');
      expect(notices()).toHaveLength(0);
      expect(t.logs.entries().some((e) => e.msg === 'session closed notice failed')).toBe(true);
      expect(t.logs.text()).not.toContain(email);
      const [row] = await harness.migrator.query(
        `SELECT count(*)::int AS n FROM app.refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
        [user.userId],
      );
      expect(row.n).toBe(0);
    });
  });
});
