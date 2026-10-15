import { randomUUID } from 'node:crypto';
import { formatMexicoCityDateTime } from '@devchrisvaz/wallet-contract';
import { escapeHtml, layout } from '../../../platform/mail/html.js';
import type { AppLogger } from '../../../shared/logger.js';
import type { NoticeDispatcher } from '../../../platform/mail/notice-dispatcher.js';
import type { Clock } from '../../../shared/clock.js';
import { DomainError } from '../../../shared/errors.js';
import type { Transaction, TransactionRunner } from '../../../shared/transaction.js';
import type { AuditWriter } from '../../audit/application/audit-writer.js';
import type { UserRepository } from '../../identity/application/users.js';
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
  /** Dueño del alta y avisos que no hacen esperar la respuesta (BEN-12). */
  readonly users: UserRepository;
  readonly notices: NoticeDispatcher;
  readonly logger: AppLogger;
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

/**
 * Aviso del alta (BEN-12): nombre, alias, solo los últimos 4 dígitos de la CLABE y cuándo (hora de
 * la Ciudad de México). El alias va en el asunto, sin saltos de línea.
 */
export function beneficiaryAddedEmail(input: {
  readonly name: string;
  readonly alias: string;
  readonly clabe: string;
  readonly at: Date;
}) {
  const subject = `Agregaste a ${input.alias.replace(/[\r\n]+/g, ' ')} como beneficiario`;
  const lines = [
    `Agregaste a ${input.alias} como beneficiario en TreoWallet.`,
    `Nombre: ${input.name}.`,
    `CLABE con terminación ${input.clabe.slice(-4)}.`,
    `Fecha y hora: ${formatMexicoCityDateTime(input.at)} (hora de la Ciudad de México).`,
    'Si fuiste tú, no tienes que hacer nada.',
    'Si no fuiste tú, responde este correo para que lo revisemos contigo.',
  ];
  return {
    subject,
    text: lines.join('\n'),
    html: layout(subject, lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')),
  };
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
      const result = await this.attempt(userId, input, account.accountId);
      if (result.created) await this.notify(userId, result.beneficiary);
      return result;
    } catch (error) {
      if (!(error instanceof BeneficiaryDuplicate)) throw error;
      return this.deps.transactions.run(async (tx) => {
        const existing = await this.existing(tx, userId, input);
        if (!existing) throw conflict();
        return { beneficiary: existing, created: false };
      });
    }
  }

  /** Después del COMMIT y sin esperar al servidor de correo; solo en altas nuevas (BEN-12). */
  private async notify(userId: string, beneficiary: BeneficiaryRecord): Promise<void> {
    // La lectura del dueño ocurre después del COMMIT: si falla, solo se registra (PLT-16).
    try {
      const owner = await this.deps.users.findById(userId);
      if (!owner) return;
      this.deps.notices.send(
        {
          to: owner.email,
          ...beneficiaryAddedEmail({
            name: beneficiary.name,
            alias: beneficiary.alias,
            clabe: beneficiary.clabe,
            at: this.deps.clock.now(),
          }),
        },
        'beneficiary-notice',
      );
    } catch (error) {
      this.deps.logger.error(
        { err: error, beneficiaryId: beneficiary.id },
        'beneficiary notice failed',
      );
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
