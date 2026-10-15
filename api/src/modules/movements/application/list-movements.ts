import type { Movement, MovementPage } from '@devchrisvaz/wallet-contract';
import { addDays, startOfBusinessDay } from '../../../shared/business-day.js';
import { DomainError } from '../../../shared/errors.js';
import { Money } from '../../../shared/money.js';
import type { AccountRepository } from '../../accounts/application/accounts.js';
import type { MovementType } from '../../transfers/domain/ledger.js';
import type { MovementCursor, MovementFilters } from './cursor.js';
import type { MovementReader, MovementRecord } from './ports.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MovementListQuery {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly types: readonly MovementType[];
  readonly limit: number;
  readonly cursor?: string | undefined;
}

function toMovement(record: MovementRecord): Movement {
  return {
    id: record.id,
    type: record.type,
    amount: Money.fromCents(record.amountCents).toDecimalString(),
    balanceAfter: Money.fromCents(record.balanceAfterCents).toDecimalString(),
    concept: record.concept,
    reference: record.reference === null ? null : String(record.reference),
    counterparty: record.counterparty,
    transferId: record.transferId,
    occurredAt: new Date(record.occurredAt).toISOString(),
  };
}

/**
 * `GET /accounts/{accountId}/movements` (HIS-01 a HIS-08): solo para el dueño de la cuenta (una
 * ajena, inexistente o la Tesorería responden el mismo 404). Lee `limit + 1` filas para saber si hay
 * otra página y, si la hay, firma un cursor con la posición del último movimiento devuelto y los
 * filtros de esta consulta.
 */
export class ListMovements {
  constructor(
    private readonly deps: {
      readonly accounts: AccountRepository;
      readonly reader: MovementReader;
      readonly cursors: MovementCursor;
    },
  ) {}

  async execute(
    userId: string,
    accountId: string,
    query: MovementListQuery,
  ): Promise<MovementPage> {
    if (!UUID.test(accountId)) throw this.notFound();
    const account = await this.deps.accounts.findOwnedBy(userId, accountId);
    if (!account) throw this.notFound();
    const filters: MovementFilters = {
      accountId: account.id,
      from: query.from,
      to: query.to,
      types: query.types,
    };
    const after = query.cursor ? this.deps.cursors.decode(query.cursor, filters) : undefined;
    const rows = await this.deps.reader.page({
      accountId: account.id,
      start: query.from ? startOfBusinessDay(query.from) : undefined,
      endExclusive: query.to ? startOfBusinessDay(addDays(query.to, 1)) : undefined,
      types: query.types,
      after,
      limit: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > query.limit && last
        ? this.deps.cursors.encode({ occurredAt: last.occurredAt, id: last.id }, filters)
        : null;
    return { items: items.map(toMovement), nextCursor };
  }

  private notFound(): DomainError {
    return new DomainError('NOT_FOUND', 'La cuenta no existe');
  }
}
