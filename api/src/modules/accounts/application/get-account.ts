import type { Account } from '@devchrisvaz/wallet-contract';
import { DomainError } from '../../../shared/errors.js';
import { toAccountView } from './account-view.js';
import type { AccountRepository } from './accounts.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accountNotFound(): DomainError {
  return new DomainError('NOT_FOUND', 'La cuenta no existe');
}

/**
 * `GET /accounts/{accountId}` (ACC-12, ACC-06, ACC-16): la cuenta solo si es USER y del usuario. Una
 * inexistente, una ajena, la Tesorería o un id que ni siquiera es UUID dan el mismo 404 (el
 * contrato no declara 422 para esta operación).
 */
export class GetAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(userId: string, accountId: string): Promise<Account> {
    if (!UUID.test(accountId)) throw accountNotFound();
    const account = await this.accounts.findOwnedBy(userId, accountId);
    if (!account) throw accountNotFound();
    return toAccountView(account);
  }
}
