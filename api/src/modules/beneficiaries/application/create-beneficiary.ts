import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { Transaction, TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { BeneficiaryClabeResolver } from './clabe-resolver.js';

export interface BeneficiaryRecord {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly name: string;
  readonly alias: string;
  readonly clabe: string;
  readonly createdAt: Date;
}

/** La base rechazó el alta por `uq_beneficiaries_user_clabe` o `uq_beneficiaries_user_alias`. */
export class BeneficiaryDuplicate extends Error {
  constructor() {
    super('Beneficiario duplicado');
    this.name = 'BeneficiaryDuplicate';
  }
}

export interface BeneficiaryStore {
  findByClabe(tx: Transaction, userId: string, clabe: string): Promise<BeneficiaryRecord | null>;
  findByAlias(tx: Transaction, userId: string, alias: string): Promise<BeneficiaryRecord | null>;
  /** Lanza `BeneficiaryDuplicate` si la base detecta el duplicado. */
  insert(tx: Transaction, row: BeneficiaryRecord): Promise<void>;
  listByUser(userId: string): Promise<BeneficiaryRecord[]>;
}

export interface CreateBeneficiaryDeps {
  readonly transactions: TransactionRunner;
  readonly store: BeneficiaryStore;
  readonly resolver: BeneficiaryClabeResolver;
  readonly audit: AuditWriter;
  readonly clock: Clock;
}

export interface CreateBeneficiaryInput {
  readonly name: string;
  readonly alias: string;
  readonly clabe: string;
}

export interface CreateBeneficiaryResult {
  readonly beneficiary: BeneficiaryRecord;
  /** `false` cuando ya existía con los mismos datos (respuesta 200). */
  readonly created: boolean;
}

function conflict(): DomainError {
  return new DomainError(
    'BENEFICIARY_CONFLICT',
    'Ya tienes un beneficiario con esa CLABE o con ese alias y otros datos',
  );
}

/**
 * `POST /beneficiaries` (BEN-01, BEN-07, BEN-11). Valida la CLABE en el orden de BEN-06 y después
 * aplica la idempotencia por contenido: la misma CLABE con el mismo nombre y alias devuelve el
 * existente; con otros datos, o un alias ya usado, es 409. `BENEFICIARY_CREATED` se audita en la
 * transacción del alta y solo en altas nuevas. Si dos altas compiten, la constraint única decide y
 * la perdedora relee y aplica la misma regla.
 */
export class CreateBeneficiary {
  constructor(private readonly deps: CreateBeneficiaryDeps) {}

  async execute(userId: string, input: CreateBeneficiaryInput): Promise<CreateBeneficiaryResult> {
    const account = await this.deps.resolver.resolve(userId, input.clabe);
    try {
      return await this.attempt(userId, input, account.accountId);
    } catch (error) {
      if (!(error instanceof BeneficiaryDuplicate)) throw error;
      return this.deps.transactions.run(async (tx) => {
        const existing = await this.existing(tx, userId, input);
        if (!existing) throw conflict();
        return { beneficiary: existing, created: false };
      });
    }
  }

  private attempt(
    userId: string,
    input: CreateBeneficiaryInput,
    accountId: string,
  ): Promise<CreateBeneficiaryResult> {
    const { transactions, store, audit, clock } = this.deps;
    return transactions.run(async (tx) => {
      const existing = await this.existing(tx, userId, input);
      if (existing) return { beneficiary: existing, created: false };
      const beneficiary: BeneficiaryRecord = {
        id: randomUUID(),
        userId,
        accountId,
        name: input.name,
        alias: input.alias,
        clabe: input.clabe,
        createdAt: clock.now(),
      };
      await store.insert(tx, beneficiary);
      await audit.record(tx, {
        action: 'BENEFICIARY_CREATED',
        actor: { type: 'USER', userId },
        entity: { type: 'beneficiary', id: beneficiary.id },
      });
      return { beneficiary, created: true };
    });
  }

  /** El existente si coincide todo; conflicto si la CLABE o el alias ya están con otros datos. */
  private async existing(
    tx: Transaction,
    userId: string,
    input: CreateBeneficiaryInput,
  ): Promise<BeneficiaryRecord | null> {
    const byClabe = await this.deps.store.findByClabe(tx, userId, input.clabe);
    if (byClabe) {
      if (byClabe.name === input.name && byClabe.alias === input.alias) return byClabe;
      throw conflict();
    }
    if (await this.deps.store.findByAlias(tx, userId, input.alias)) throw conflict();
    return null;
  }
}
