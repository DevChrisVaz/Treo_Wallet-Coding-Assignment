import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import {
  beneficiaryRow,
  insertRow,
  ownTransferRow,
  violation,
} from '../../helpers/db-constraints.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

/** Inserta con el rol de ejecución una transferencia válida con los campos cambiados. */
async function insertTransfer(overrides: Record<string, unknown> = {}) {
  const ana = await insertUserWithAccounts(harness.migrator);
  return insertRow(harness.app, 'app.transfers', ownTransferRow(ana, overrides));
}

/** Cada fila es una transferencia válida con un solo campo cambiado y la constraint que la rechaza. */
const rejected: [string, Record<string, unknown>, string][] = [
  [
    'huella con menos de 64 caracteres',
    { request_fingerprint: 'a'.repeat(63) },
    'ck_transfers_fingerprint_hex',
  ],
  [
    'huella con más de 64 caracteres',
    { request_fingerprint: 'a'.repeat(65) },
    'ck_transfers_fingerprint_hex',
  ],
  [
    'huella con mayúsculas',
    { request_fingerprint: 'A'.repeat(64) },
    'ck_transfers_fingerprint_hex',
  ],
  [
    'huella que no es hexadecimal',
    { request_fingerprint: 'g'.repeat(64) },
    'ck_transfers_fingerprint_hex',
  ],
  ['tipo fuera del catálogo', { kind: 'REFUND' }, 'ck_transfers_kind'],
  ['monto cero', { amount_cents: 0 }, 'ck_transfers_amount_positive'],
  ['monto negativo', { amount_cents: -1 }, 'ck_transfers_amount_positive'],
  ['concepto vacío', { concept: '' }, 'ck_transfers_concept_trimmed'],
  ['concepto con espacio al inicio', { concept: ' Renta' }, 'ck_transfers_concept_trimmed'],
  ['concepto con espacio al final', { concept: 'Renta ' }, 'ck_transfers_concept_trimmed'],
  ['concepto de 41 caracteres', { concept: 'c'.repeat(41) }, 'ck_transfers_concept_trimmed'],
  ['referencia negativa', { reference: -1 }, 'ck_transfers_reference_range'],
  ['referencia de 8 dígitos', { reference: 10_000_000 }, 'ck_transfers_reference_range'],
  [
    'motivo de rechazo fuera del catálogo',
    { status: 'REJECTED', rejection_reason: 'OTHER' },
    'ck_transfers_rejection_reason',
  ],
  [
    'motivo de falla fuera del catálogo',
    { status: 'FAILED', failure_reason: 'OTHER' },
    'ck_transfers_failure_reason',
  ],
  [
    'motivo de falla OTP_ATTEMPTS_EXHAUSTED como rechazo',
    { status: 'REJECTED', rejection_reason: 'OTP_ATTEMPTS_EXHAUSTED' },
    'ck_transfers_rejection_reason',
  ],
  ['OWN sin usuario', { user_id: null }, 'ck_transfers_user_key_by_kind'],
  ['OWN sin llave de idempotencia', { idempotency_key: null }, 'ck_transfers_user_key_by_kind'],
  ['OWN sin huella', { request_fingerprint: null }, 'ck_transfers_user_key_by_kind'],
  ['THIRD_PARTY sin beneficiario', { kind: 'THIRD_PARTY' }, 'ck_transfers_beneficiary_by_kind'],
  [
    'REJECTED sin motivo de rechazo',
    { status: 'REJECTED', rejection_reason: null },
    'ck_transfers_reason_by_status',
  ],
  [
    'FAILED sin motivo de falla',
    { status: 'FAILED', failure_reason: null },
    'ck_transfers_reason_by_status',
  ],
  [
    'motivo de rechazo en una PENDING_OTP',
    { rejection_reason: 'INSUFFICIENT_FUNDS' },
    'ck_transfers_reason_by_status',
  ],
  [
    'motivo de falla en una PENDING_OTP',
    { failure_reason: 'INSUFFICIENT_FUNDS' },
    'ck_transfers_reason_by_status',
  ],
  ['COMPLETED sin completed_at', { status: 'COMPLETED' }, 'ck_transfers_completed_at_by_status'],
  [
    'completed_at en una PENDING_OTP',
    { completed_at: new Date() },
    'ck_transfers_completed_at_by_status',
  ],
];

describe('TRF-07 CHECK de transferencias por inserción directa', () => {
  it.each(rejected)('TRF-07 rechaza %s por %s', async (_label, overrides, constraint) => {
    expect(await violation(insertTransfer(overrides))).toMatchObject({
      code: '23514',
      constraint,
    });
  });

  it.each([
    [
      'huella en hexadecimal minúscula de 64 caracteres',
      { request_fingerprint: 'abcdef0123456789'.repeat(4) },
    ],
    ['monto de 1 centavo', { amount_cents: 1 }],
    ['concepto de 1 caracter', { concept: 'R' }],
    ['concepto de 40 caracteres', { concept: 'c'.repeat(40) }],
    ['concepto con espacios internos', { concept: 'Renta de octubre' }],
    ['referencia 0', { reference: 0 }],
    ['referencia 9999999', { reference: 9_999_999 }],
    [
      'REJECTED con motivo de rechazo',
      { status: 'REJECTED', rejection_reason: 'DAILY_LIMIT_EXCEEDED' },
    ],
    [
      'FAILED con OTP_ATTEMPTS_EXHAUSTED',
      { status: 'FAILED', failure_reason: 'OTP_ATTEMPTS_EXHAUSTED' },
    ],
  ])('TRF-07 acepta %s', async (_label, overrides) => {
    await insertTransfer(overrides);
  });

  it('TRF-07 un fondeo FUNDING no necesita usuario, llave ni huella', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    await insertRow(
      harness.app,
      'app.transfers',
      ownTransferRow(ana, {
        kind: 'FUNDING',
        user_id: null,
        idempotency_key: null,
        request_fingerprint: null,
        from_account_id: TREASURY_ACCOUNT_ID,
        to_account_id: ana.principalId,
      }),
    );
  });
});

describe('TRF-08 tipo de transferencia y beneficiario', () => {
  it('TRF-08 una transferencia OWN no puede llevar beneficiario', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const beneficiary = beneficiaryRow(ana, luis);
    await insertRow(harness.migrator, 'app.beneficiaries', beneficiary);
    const error = await violation(
      insertRow(
        harness.app,
        'app.transfers',
        ownTransferRow(ana, { beneficiary_id: beneficiary.id }),
      ),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_transfers_beneficiary_by_kind' });
  });

  it('TRF-08 una transferencia THIRD_PARTY con beneficiario se acepta', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    const beneficiary = beneficiaryRow(ana, luis);
    await insertRow(harness.migrator, 'app.beneficiaries', beneficiary);
    await insertRow(
      harness.app,
      'app.transfers',
      ownTransferRow(ana, {
        kind: 'THIRD_PARTY',
        beneficiary_id: beneficiary.id,
        to_account_id: luis.principalId,
      }),
    );
  });
});

describe('TRF-07 llaves foráneas de transferencias', () => {
  it.each([
    ['la cuenta de origen', { from_account_id: randomUUID() }, 'fk_transfers_from_account'],
    ['la cuenta de destino', { to_account_id: randomUUID() }, 'fk_transfers_to_account'],
    ['el usuario', { user_id: randomUUID() }, 'fk_transfers_user'],
    [
      'el beneficiario',
      { kind: 'THIRD_PARTY', beneficiary_id: randomUUID() },
      'fk_transfers_beneficiary',
    ],
  ])('TRF-07 %s debe existir (%s)', async (_label, overrides, constraint) => {
    expect(await violation(insertTransfer(overrides))).toMatchObject({
      code: '23503',
      constraint,
    });
  });
});

describe('TRF-13 respaldo de la base para el límite diario', () => {
  const day = '2026-10-14';

  async function insertUsage(overrides: Record<string, unknown> = {}) {
    const ana = await insertUserWithAccounts(harness.migrator);
    const row = { user_id: ana.userId, day, used_cents: 0, limit_cents: 1_000_000, ...overrides };
    await insertRow(harness.app, 'app.daily_transfer_usage', row);
    return row;
  }

  it('TRF-13 rechaza insertar un uso mayor que el límite (ck_daily_transfer_usage_within_limit)', async () => {
    expect(await violation(insertUsage({ used_cents: 1_000_001 }))).toMatchObject({
      code: '23514',
      constraint: 'ck_daily_transfer_usage_within_limit',
    });
  });

  it('TRF-13 rechaza subir el uso por encima del límite aunque la fila ya exista', async () => {
    const row = await insertUsage({ used_cents: 900_000 });
    const error = await violation(
      harness.app.query(
        `UPDATE daily_transfer_usage SET used_cents = used_cents + 100001
          WHERE user_id = $1 AND day = $2`,
        [row.user_id, day],
      ),
    );
    expect(error).toMatchObject({
      code: '23514',
      constraint: 'ck_daily_transfer_usage_within_limit',
    });
  });

  it('TRF-13 permite usar exactamente el límite', async () => {
    await insertUsage({ used_cents: 1_000_000 });
  });

  it('TRF-13 rechaza un uso negativo (ck_daily_transfer_usage_non_negative)', async () => {
    expect(await violation(insertUsage({ used_cents: -1 }))).toMatchObject({
      code: '23514',
      constraint: 'ck_daily_transfer_usage_non_negative',
    });
  });

  it('TRF-13 rechaza un límite de cero (ck_daily_transfer_usage_limit_positive)', async () => {
    // Con uso 0 el límite 0 cumple used <= limit: solo falla la constraint del límite positivo.
    expect(await violation(insertUsage({ limit_cents: 0 }))).toMatchObject({
      code: '23514',
      constraint: 'ck_daily_transfer_usage_limit_positive',
    });
  });

  it('TRF-13 el usuario de la fila debe existir (fk_daily_transfer_usage_user)', async () => {
    expect(await violation(insertUsage({ user_id: randomUUID() }))).toMatchObject({
      code: '23503',
      constraint: 'fk_daily_transfer_usage_user',
    });
  });
});
