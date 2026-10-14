import type { MovementType } from '@devchrisvaz/wallet-contract';

/** Filtros del historial; forman parte de la clave para reiniciar el cursor al cambiar (WEB-14). */
export interface MovementFilters {
  from: string;
  to: string;
  types: MovementType[];
}

/** Claves de TanStack Query (D11 de web-app). */
export const queryKeys = {
  accounts: ['accounts'] as const,
  account: (accountId: string) => ['account', accountId] as const,
  allMovements: ['movements'] as const,
  movements: (accountId: string, filters: MovementFilters) =>
    ['movements', accountId, filters] as const,
  /** Últimos movimientos de Inicio: bajo `allMovements`, el comprobante también los refresca. */
  latestMovements: (accountId: string) => ['movements', accountId, 'latest'] as const,
  beneficiaries: ['beneficiaries'] as const,
  transfer: (transferId: string) => ['transfer', transferId] as const,
};
