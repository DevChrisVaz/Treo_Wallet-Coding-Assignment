import type { PgErrorTranslator } from '../../../platform/persistence/pg-errors.js';
import { DomainError } from '../../../shared/errors.js';

/**
 * Traducciones por nombre de constraint del ledger (diseño de api-ledger, sección 12). Cuando la
 * red de la base actúa en una regla que el servicio ya valida, se registra en nivel ERROR: la
 * respuesta es la correcta, pero significa que la validación del servicio falló.
 */
export function registerLedgerTranslations(translator: PgErrorTranslator): void {
  translator.register(
    'ck_accounts_balance_non_negative',
    () => new DomainError('INSUFFICIENT_FUNDS'),
    {
      logLevel: 'error',
    },
  );
  translator.register(
    'ck_daily_transfer_usage_within_limit',
    () => new DomainError('DAILY_LIMIT_EXCEEDED'),
    { logLevel: 'error' },
  );
  // El caso de uso de alta ya resuelve estas carreras releyendo; esto es la red de seguridad.
  for (const constraint of ['uq_beneficiaries_user_clabe', 'uq_beneficiaries_user_alias']) {
    translator.register(constraint, () => new DomainError('BENEFICIARY_CONFLICT'));
  }
  translator.register(
    'ck_transfers_distinct_accounts',
    () => new DomainError('SAME_ACCOUNT_TRANSFER'),
    {
      logLevel: 'error',
    },
  );
  translator.register('ck_beneficiaries_clabe_valid', () => new DomainError('CLABE_INVALID'), {
    logLevel: 'error',
  });
  for (const constraint of [
    'fk_transfers_from_account',
    'fk_transfers_to_account',
    'fk_transfers_beneficiary',
  ]) {
    translator.register(constraint, () => new DomainError('NOT_FOUND'), { logLevel: 'warn' });
  }
  // Errores de código: 500 con alerta.
  for (const constraint of [
    'tg_ledger_entries_zero_sum',
    'tg_transfers_completed_has_entries',
    'uq_transfers_user_idempotency_key',
  ]) {
    translator.register(constraint, () => new DomainError('INTERNAL_ERROR'), { logLevel: 'error' });
  }
}
