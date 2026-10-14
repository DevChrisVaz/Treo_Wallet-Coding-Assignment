import type { IconConcept } from './icons';

/** Destinos de la navegación principal (pestañas y navegación lateral), iguales en web y móvil. */
export const navDestinations = {
  home: { label: 'Inicio', icon: 'home' },
  movements: { label: 'Movimientos', icon: 'movements' },
  transfer: { label: 'Transferir', icon: 'transfer' },
  beneficiaries: { label: 'Beneficiarios', icon: 'beneficiaries' },
} as const satisfies Record<string, { label: string; icon: IconConcept }>;

export type NavDestination = keyof typeof navDestinations;
