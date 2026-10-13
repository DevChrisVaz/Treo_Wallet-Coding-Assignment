import { describe, expect, it } from 'vitest';
import { registerLedgerTranslations } from '../../../src/modules/transfers/infrastructure/error-translations.js';
import { PgErrorTranslator } from '../../../src/platform/persistence/pg-errors.js';
import { captureLogger } from '../../helpers/logs.js';

function pgError(code: string, constraint: string) {
  return Object.assign(new Error('violación'), { code, constraint });
}

const mappings: [string, string, string, string | undefined][] = [
  ['23514', 'ck_accounts_balance_non_negative', 'INSUFFICIENT_FUNDS', 'error'],
  ['23514', 'ck_daily_transfer_usage_within_limit', 'DAILY_LIMIT_EXCEEDED', 'error'],
  ['23505', 'uq_beneficiaries_user_clabe', 'BENEFICIARY_CONFLICT', undefined],
  ['23505', 'uq_beneficiaries_user_alias', 'BENEFICIARY_CONFLICT', undefined],
  ['23514', 'ck_transfers_distinct_accounts', 'SAME_ACCOUNT_TRANSFER', 'error'],
  ['23514', 'ck_beneficiaries_clabe_valid', 'CLABE_INVALID', 'error'],
  ['23503', 'fk_transfers_from_account', 'NOT_FOUND', 'warn'],
  ['23503', 'fk_transfers_to_account', 'NOT_FOUND', 'warn'],
  ['23503', 'fk_transfers_beneficiary', 'NOT_FOUND', 'warn'],
  ['23514', 'tg_ledger_entries_zero_sum', 'INTERNAL_ERROR', 'error'],
  ['23514', 'tg_transfers_completed_has_entries', 'INTERNAL_ERROR', 'error'],
  ['23505', 'uq_transfers_user_idempotency_key', 'INTERNAL_ERROR', 'error'],
];

describe('TRF-07 traducción de las constraints del ledger', () => {
  it.each(mappings)('TRF-10 %s en %s → %s (log %s)', (sqlState, constraint, code, level) => {
    const logs = captureLogger();
    const translator = new PgErrorTranslator(logs.logger);
    registerLedgerTranslations(translator);
    expect(translator.translate(pgError(sqlState, constraint))?.code).toBe(code);
    const levels = logs.entries().map((entry) => entry.level);
    if (level) expect(levels).toContain(level);
    else expect(levels).toEqual([]);
  });
});
