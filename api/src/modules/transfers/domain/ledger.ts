import type { Money } from '../../../shared/money.js';

export type TransferKind = 'FUNDING' | 'OWN' | 'THIRD_PARTY';

/** Tipos de asiento, que son también los tipos de movimiento del historial (HIS-03). */
export const MOVEMENT_TYPES = [
  'DEPOSIT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'OWN_TRANSFER_IN',
  'OWN_TRANSFER_OUT',
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Cuenta leída bajo bloqueo: su saldo es el vigente para esta transacción. */
export interface LockedAccount {
  readonly id: string;
  readonly userId: string | null;
  readonly type: 'USER' | 'SYSTEM';
  readonly balance: Money;
}

/**
 * Tipo de cada lado del asiento según el tipo de transferencia (diseño de api-ledger, sección 6).
 * En el fondeo solo el lado USER es `DEPOSIT`; el lado de la Tesorería es `TRANSFER_OUT`.
 */
export function movementTypes(kind: TransferKind): { out: MovementType; in: MovementType } {
  switch (kind) {
    case 'FUNDING':
      return { out: 'TRANSFER_OUT', in: 'DEPOSIT' };
    case 'OWN':
      return { out: 'OWN_TRANSFER_OUT', in: 'OWN_TRANSFER_IN' };
    case 'THIRD_PARTY':
      return { out: 'TRANSFER_OUT', in: 'TRANSFER_IN' };
  }
}
