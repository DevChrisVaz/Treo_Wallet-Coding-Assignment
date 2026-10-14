import { createHash } from 'node:crypto';
import type { Money } from '../../../shared/money.js';

export interface FingerprintInput {
  readonly fromAccountId: string;
  readonly destination: { readonly type: 'OWN_ACCOUNT' | 'BENEFICIARY'; readonly id: string };
  readonly amount: Money;
  readonly concept: string;
  readonly reference: string;
}

/**
 * Huella del contenido de una transferencia (TRF-04): SHA-256 hexadecimal de los valores ya
 * interpretados, serializados como arreglo JSON (sin ambigüedad aunque el concepto traiga
 * separadores). El monto entra en centavos, así que `"100.5"` y `"100.50"` dan la misma huella.
 */
export function transferFingerprint(input: FingerprintInput): string {
  const canonical = JSON.stringify([
    input.fromAccountId,
    input.destination.type,
    input.destination.id,
    input.amount.cents.toString(),
    input.concept,
    input.reference,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}
