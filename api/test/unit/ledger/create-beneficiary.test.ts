import { describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import type { AuditEvent } from '../../../src/modules/audit/domain/audit-event.js';
import {
  BeneficiaryDuplicate,
  CreateBeneficiary,
  type BeneficiaryRecord,
  type BeneficiaryStore,
} from '../../../src/modules/beneficiaries/application/create-beneficiary.js';
import type { BeneficiaryClabeResolver } from '../../../src/modules/beneficiaries/application/clabe-resolver.js';
import type { UserRepository } from '../../../src/modules/identity/application/users.js';
import { NoticeDispatcher } from '../../../src/platform/mail/notice-dispatcher.js';
import { captureLogger } from '../../helpers/logs.js';
import type { Transaction, TransactionRunner } from '../../../src/shared/transaction.js';
import { DomainError } from '../../../src/shared/errors.js';
import { FakeClock } from '../../helpers/fake-clock.js';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLABE = '999180000000000017';

/** Almacén en memoria; `raceOnInsert` simula que otra petición insertó lo mismo justo antes. */
class MemoryStore implements BeneficiaryStore {
  readonly rows: BeneficiaryRecord[] = [];
  raceOnInsert: BeneficiaryRecord | null = null;

  async findByClabe(_tx: Transaction, userId: string, clabe: string) {
    return this.rows.find((row) => row.userId === userId && row.clabe === clabe) ?? null;
  }
  async findByAlias(_tx: Transaction, userId: string, alias: string) {
    return this.rows.find((row) => row.userId === userId && row.alias === alias) ?? null;
  }
  async insert(_tx: Transaction, row: BeneficiaryRecord) {
    if (this.raceOnInsert) {
      this.rows.push(this.raceOnInsert);
      this.raceOnInsert = null;
      throw new BeneficiaryDuplicate();
    }
    this.rows.push(row);
  }
  async listByUser(userId: string) {
    return this.rows.filter((row) => row.userId === userId);
  }
}

const transactions: TransactionRunner = {
  run: (work) => work({} as Transaction),
};
const resolver = {
  resolve: async () => ({ accountId: 'luis-principal', ownerId: 'luis' }),
} as unknown as BeneficiaryClabeResolver;

function setup() {
  const store = new MemoryStore();
  const events: AuditEvent[] = [];
  const audit: AuditWriter = {
    record: async (_tx, event) => void events.push(event),
    recordStandalone: async (event) => void events.push(event),
  };
  const useCase = new CreateBeneficiary({
    transactions,
    store,
    resolver,
    audit,
    users: { findById: async () => ({ email: 'ana@example.com' }) } as unknown as UserRepository,
    notices: new NoticeDispatcher({ send: async () => undefined }, captureLogger().logger),
    logger: captureLogger().logger,
    clock: new FakeClock('2026-10-13T18:00:00.000Z'),
  });
  return { store, events, useCase };
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return error instanceof DomainError ? error.code : String(error);
  }
}

describe('BEN-07 alta idempotente por contenido', () => {
  it('BEN-01 crea el beneficiario con la cuenta resuelta y audita BENEFICIARY_CREATED', async () => {
    const { useCase, events, store } = setup();
    const result = await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    expect(result.created).toBe(true);
    expect(store.rows[0]).toMatchObject({ accountId: 'luis-principal', alias: 'Luis' });
    expect(events).toEqual([
      expect.objectContaining({
        action: 'BENEFICIARY_CREATED',
        actor: { type: 'USER', userId: USER },
        entity: { type: 'beneficiary', id: result.beneficiary.id },
      }),
    ]);
  });

  it('BEN-07 el mismo contenido otra vez devuelve el existente sin auditar de nuevo', async () => {
    const { useCase, events, store } = setup();
    const first = await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    const again = await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    expect(again).toEqual({ beneficiary: first.beneficiary, created: false });
    expect(events).toHaveLength(1);
    // Tras el reintento sigue habiendo un solo beneficiario con esa CLABE.
    expect((await store.listByUser(USER)).filter((row) => row.clabe === CLABE)).toHaveLength(1);
  });

  it('BEN-07 la misma CLABE con otro alias o nombre es BENEFICIARY_CONFLICT', async () => {
    const { useCase } = setup();
    await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    expect(
      await codeOf(useCase.execute(USER, { name: 'Luis Pérez', alias: 'Lu', clabe: CLABE })),
    ).toBe('BENEFICIARY_CONFLICT');
    expect(
      await codeOf(useCase.execute(USER, { name: 'Luis P.', alias: 'Luis', clabe: CLABE })),
    ).toBe('BENEFICIARY_CONFLICT');
  });

  it('BEN-07 un alias que ya usa otra CLABE es BENEFICIARY_CONFLICT', async () => {
    const { useCase } = setup();
    await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    expect(
      await codeOf(
        useCase.execute(USER, { name: 'Otro', alias: 'Luis', clabe: '999180000000000025' }),
      ),
    ).toBe('BENEFICIARY_CONFLICT');
  });

  it('BEN-08 si otra petición gana la carrera con el mismo contenido, relee y responde el existente', async () => {
    const { useCase, store, events } = setup();
    const winner: BeneficiaryRecord = {
      id: 'ganador',
      userId: USER,
      accountId: 'luis-principal',
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: CLABE,
      createdAt: new Date('2026-10-13T17:59:59.000Z'),
    };
    store.raceOnInsert = winner;
    const result = await useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE });
    expect(result).toEqual({ beneficiary: winner, created: false });
    expect(events).toEqual([]);
  });

  it('BEN-08 si la carrera la ganó un contenido distinto, responde BENEFICIARY_CONFLICT', async () => {
    const { useCase, store } = setup();
    store.raceOnInsert = {
      id: 'ganador',
      userId: USER,
      accountId: 'luis-principal',
      name: 'Luis Pérez',
      alias: 'Otro alias',
      clabe: CLABE,
      createdAt: new Date(),
    };
    expect(
      await codeOf(useCase.execute(USER, { name: 'Luis Pérez', alias: 'Luis', clabe: CLABE })),
    ).toBe('BENEFICIARY_CONFLICT');
  });
});
