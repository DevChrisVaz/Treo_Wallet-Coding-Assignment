import { createHmac, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  EMAIL_VERIFICATION_POLICY,
  OneTimeCodeService,
} from '../../../src/modules/identity/application/one-time-codes.js';
import { PgOneTimeCodeStore } from '../../../src/modules/identity/infrastructure/pg-one-time-code-store.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();
const secret = Buffer.alloc(32, 5);

function setup() {
  const clock = new FakeClock('2026-10-13T18:00:00Z');
  const service = new OneTimeCodeService(new PgOneTimeCodeStore(), clock, secret);
  const runner = new TypeormTransactionRunner(harness.app);
  const subject = randomUUID();
  const policy = EMAIL_VERIFICATION_POLICY;
  return {
    clock,
    subject,
    issue: () => runner.run((tx) => service.issue(tx, 'EMAIL_VERIFICATION', subject, policy)),
    reissue: () => runner.run((tx) => service.reissue(tx, 'EMAIL_VERIFICATION', subject, policy)),
    verify: (code: string) =>
      runner.run((tx) => service.verify(tx, 'EMAIL_VERIFICATION', subject, code, policy)),
  };
}

function otherCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

async function row(subject: string) {
  const [result] = await harness.migrator.query(
    `SELECT code_hash, attempts, resend_count, expires_at, consumed_at
       FROM app.one_time_codes WHERE subject_id = $1`,
    [subject],
  );
  return result;
}

describe('IDN-05 códigos de un solo uso', () => {
  it('IDN-05 el código es de 6 dígitos, vale 15 minutos y se guarda solo como HMAC', async () => {
    const { issue, subject } = setup();
    const { code, expiresAt } = await issue();
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(expiresAt.toISOString()).toBe('2026-10-13T18:15:00.000Z');
    const stored = await row(subject);
    const expected = createHmac('sha256', secret)
      .update(`EMAIL_VERIFICATION:${subject}:${code}`)
      .digest('hex');
    expect(stored.code_hash).toBe(expected);
    expect(stored.code_hash).not.toBe(code);
  });

  it('IDN-05 el código correcto se acepta una sola vez', async () => {
    const { issue, verify } = setup();
    const { code } = await issue();
    expect(await verify(code)).toEqual({ status: 'VALID' });
    expect(await verify(code)).toEqual({ status: 'UNUSABLE', attemptsRemaining: 0 });
  });

  it('IDN-05 cada fallo descuenta un intento y al tercero el código queda inutilizable', async () => {
    const { issue, verify, subject } = setup();
    const { code } = await issue();
    expect(await verify(otherCode(code))).toEqual({
      status: 'INVALID',
      attemptsRemaining: 2,
      exhausted: false,
    });
    expect(await verify(otherCode(code))).toMatchObject({ attemptsRemaining: 1 });
    expect(await verify(otherCode(code))).toEqual({
      status: 'INVALID',
      attemptsRemaining: 0,
      exhausted: true,
    });
    expect((await row(subject)).attempts).toBe(3);
    expect(await verify(code)).toEqual({ status: 'UNUSABLE', attemptsRemaining: 0 });
  });

  it('IDN-05 un código correcto 16 minutos después está vencido, con 0 intentos restantes', async () => {
    const { issue, verify, clock } = setup();
    const { code } = await issue();
    clock.advance(16 * 60_000);
    expect(await verify(code)).toEqual({ status: 'EXPIRED', attemptsRemaining: 0 });
  });

  it('IDN-05 un reenvío invalida el código anterior y reinicia intentos y vigencia', async () => {
    const { issue, reissue, verify, clock, subject } = setup();
    const first = await issue();
    await verify(otherCode(first.code));
    clock.advance(10 * 60_000);
    const second = await reissue();
    expect(second?.expiresAt.toISOString()).toBe('2026-10-13T18:25:00.000Z');
    expect(await row(subject)).toMatchObject({ attempts: 0, resend_count: 1 });
    if (first.code !== second?.code) {
      expect(await verify(first.code)).toMatchObject({ status: 'INVALID' });
    }
    expect(await verify(second?.code ?? '')).toEqual({ status: 'VALID' });
  });

  it('IDN-05 admite a lo más 3 reenvíos por registro', async () => {
    const { issue, reissue } = setup();
    await issue();
    expect(await reissue()).toMatchObject({ resendsRemaining: 2 });
    expect(await reissue()).toMatchObject({ resendsRemaining: 1 });
    expect(await reissue()).toMatchObject({ resendsRemaining: 0 });
    expect(await reissue()).toBeNull();
  });
});
