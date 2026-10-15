import { DomainError } from '../../../shared/errors.js';
import type { Money } from '../../../shared/money.js';
import type { AccountRepository } from '../../accounts/application/accounts.js';
import type { TransferKind } from '../domain/ledger.js';

/** Solicitud ya validada y con valores interpretados. */
export interface TransferRequest {
  readonly fromAccountId: string;
  readonly destination: { readonly type: 'OWN_ACCOUNT' | 'BENEFICIARY'; readonly id: string };
  readonly amount: Money;
  readonly concept: string;
  readonly reference: number | null;
  /** Instante de ejecución (ya con minuto exacto); sin él es inmediata. */
  readonly scheduledFor?: Date | null | undefined;
}

export interface ResolvedRoute {
  readonly kind: Exclude<TransferKind, 'FUNDING'>;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly beneficiaryId: string | null;
}

/** Beneficiarios del usuario, para resolver el destino a su cuenta. */
export interface OwnedBeneficiaries {
  findOwned(userId: string, beneficiaryId: string): Promise<{ accountId: string } | null>;
}

export function notFound(): DomainError {
  return new DomainError('NOT_FOUND', 'La cuenta o el beneficiario no existe');
}

/**
 * Resuelve el destino y verifica la propiedad antes de abrir la transacción (TRF-06, TRF-07,
 * ACC-16), para responder 404 o 422 sin consumir la llave de idempotencia. El tipo (`OWN` o
 * `THIRD_PARTY`) lo decide el servidor. La sentencia de bloqueo vuelve a filtrar por propiedad.
 */
export class TransferDestinationResolver {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly beneficiaries: OwnedBeneficiaries,
  ) {}

  async resolve(userId: string, request: TransferRequest): Promise<ResolvedRoute> {
    if (
      request.destination.type === 'OWN_ACCOUNT' &&
      request.destination.id === request.fromAccountId
    ) {
      throw new DomainError('SAME_ACCOUNT_TRANSFER', 'El origen y el destino son la misma cuenta');
    }
    const from = await this.accounts.findOwnedBy(userId, request.fromAccountId);
    if (!from) throw notFound();

    if (request.destination.type === 'OWN_ACCOUNT') {
      const to = await this.accounts.findOwnedBy(userId, request.destination.id);
      if (!to) throw notFound();
      return { kind: 'OWN', fromAccountId: from.id, toAccountId: to.id, beneficiaryId: null };
    }

    const beneficiary = await this.beneficiaries.findOwned(userId, request.destination.id);
    if (!beneficiary) throw notFound();
    if (beneficiary.accountId === from.id) {
      throw new DomainError('SAME_ACCOUNT_TRANSFER', 'El origen y el destino son la misma cuenta');
    }
    return {
      kind: 'THIRD_PARTY',
      fromAccountId: from.id,
      toAccountId: beneficiary.accountId,
      beneficiaryId: request.destination.id,
    };
  }
}
