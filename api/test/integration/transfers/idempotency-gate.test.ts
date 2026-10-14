import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IdempotencyGate } from '../../../src/modules/transfers/application/idempotency-gate.js';
import type { TransferRow } from '../../../src/modules/transfers/application/ports.js';
import { PgTransferStore } from '../../../src/modules/transfers/infrastructure/pg-transfer-store.js';
import { TypeormTransactionRunner } from '../../../src/platform/persistence/transaction.js';
import { DomainError } from '../../../src/shared/errors.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts, type FixtureUser } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();
const gate = new IdempotencyGate(new PgTransferStore());
let ana: FixtureUser;

beforeEach(async () => {
  ana = await insertUserWithAccounts(harness.migrator);
});

function row(key: string, fingerprint = 'a'.repeat(64)): TransferRow {
  return {
    id: randomUUID(),
    userId: ana.userId,
    idempotencyKey: key,
    fingerprint,
    kind: 'OWN',
    status: 'PENDING_OTP',
    fromAccountId: ana.principalId,
    toAccountId: ana.ahorroId,
    beneficiaryId: null,
    amountCents: 100n,
    concept: 'Ahorro',
    reference: 1,
    requiresOtp: false,
    rejectionReason: null,
    failureReason: null,
    otpExpiresAt: null,
    createdAt: new Date('2026-10-13T18:00:00Z'),
    completedAt: null,
    scheduledFor: null,
    cancelledAt: null,
  };
}

const runner = () => new TypeormTransactionRunner(harness.app);

describe('TRF-03 reclamo de la llave de idempotencia', () => {
  it('TRF-03 la primera petición reclama la llave y la segunda recibe la transferencia original', async () => {
    const key = randomUUID();
    const first = row(key);
    expect(await runner().run((tx) => gate.claim(tx, first))).toEqual({ kind: 'NEW' });
    const second = await runner().run((tx) => gate.claim(tx, row(key)));
    expect(second).toMatchObject({ kind: 'REPLAY', existing: { id: first.id } });
  });

  it('TRF-04 la misma llave con otro contenido es IDEMPOTENCY_KEY_REUSED', async () => {
    const key = randomUUID();
    await runner().run((tx) => gate.claim(tx, row(key)));
    await expect(
      runner().run((tx) => gate.claim(tx, row(key, 'b'.repeat(64)))),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('TRF-05 una petición simultánea con la misma llave espera a la primera y recibe su transferencia', async () => {
    const key = randomUUID();
    const first = row(key);
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let claimed!: () => void;
    const firstClaimed = new Promise<void>((resolve) => (claimed = resolve));
    const one = runner().run(async (tx) => {
      const result = await gate.claim(tx, first);
      claimed();
      await hold;
      return result;
    });
    await firstClaimed;
    const two = runner().run((tx) => gate.claim(tx, row(key)));
    await new Promise((resolve) => setTimeout(resolve, 150));
    release();
    expect(await one).toEqual({ kind: 'NEW' });
    expect(await two).toMatchObject({ kind: 'REPLAY', existing: { id: first.id } });
  });

  it('TRF-02 si la transacción que reclamó la llave se revierte, la llave queda libre', async () => {
    const key = randomUUID();
    await expect(
      runner().run(async (tx) => {
        await gate.claim(tx, row(key));
        throw new DomainError('NOT_FOUND');
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await runner().run((tx) => gate.claim(tx, row(key)))).toEqual({ kind: 'NEW' });
  });
});
