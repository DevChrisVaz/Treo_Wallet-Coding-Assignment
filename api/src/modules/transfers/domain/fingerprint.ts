import { createHash } from 'node:crypto';
import type { Money } from '../../../shared/money.js';

export interface FingerprintInput {
  readonly fromAccountId: string;
  readonly destination: { readonly type: 'OWN_ACCOUNT' | 'BENEFICIARY'; readonly id: string };
  readonly amount: Money;
  readonly concept: string;
  /** Referencia en texto; `''` (o nula) si no se indicó: ausente y omitida dan la misma huella. */
  readonly reference: string | null;
  /** Instante programado en ISO 8601 UTC (`toISOString()`); ausente o nulo en las inmediatas. */
  readonly scheduledFor?: string | null;
}

/**
 * Huella del contenido de una transferencia (TRF-04): SHA-256 hexadecimal de los valores ya
 * interpretados, serializados como arreglo JSON (sin ambigüedad aunque el concepto traiga
 * separadores). El monto entra en centavos, así que `"100.5"` y `"100.50"` dan la misma huella.
 *
 * El instante programado entra como séptimo elemento **solo cuando existe** (TRF-29, D3): la huella de
 * toda inmediata ya guardada no cambia, y una programada nunca coincide con una inmediata.
 */
export function transferFingerprint(input: FingerprintInput): string {
  const values = [
    input.fromAccountId,
    input.destination.type,
    input.destination.id,
    input.amount.cents.toString(),
    input.concept,
    input.reference ?? '',
  ];
  if (input.scheduledFor) values.push(input.scheduledFor);
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
