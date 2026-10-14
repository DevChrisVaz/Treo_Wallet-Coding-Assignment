import type { Tone, movementType } from './conventions';

/**
 * Conceptos con icono. Web y móvil usan el mismo icono de Lucide por concepto (DSG-15): cada
 * cliente importa los componentes de su librería y una prueba compara contra `iconNames`.
 */
export const iconConcepts = [
  'home',
  'movements',
  'transfer',
  'scheduled',
  'beneficiaries',
  'logout',
  'moneyIn',
  'moneyOut',
  'deposit',
  'ownTransfer',
  'success',
  'error',
  'warning',
  'info',
  'close',
  'back',
  'forward',
  'expand',
  'filter',
  'account',
] as const;

export type IconConcept = (typeof iconConcepts)[number];

/** Nombre del componente de Lucide (1.48.0) de cada concepto. */
export const iconNames = {
  home: 'House',
  movements: 'ReceiptText',
  transfer: 'Send',
  /** Transferencias programadas (web: "Programadas"); distinto de "transfer" (R58). */
  scheduled: 'CalendarClock',
  beneficiaries: 'Users',
  logout: 'LogOut',
  moneyIn: 'ArrowDownLeft',
  moneyOut: 'ArrowUpRight',
  deposit: 'Landmark',
  ownTransfer: 'Repeat2',
  success: 'CircleCheck',
  error: 'CircleAlert',
  warning: 'TriangleAlert',
  info: 'Info',
  close: 'X',
  back: 'ChevronLeft',
  forward: 'ChevronRight',
  expand: 'ChevronDown',
  filter: 'SlidersHorizontal',
  account: 'UserRound',
} as const satisfies Record<IconConcept, string>;

/** Icono del avatar de cada tipo de movimiento. */
export const movementIcon = {
  DEPOSIT: 'deposit',
  TRANSFER_IN: 'moneyIn',
  TRANSFER_OUT: 'moneyOut',
  OWN_TRANSFER_IN: 'ownTransfer',
  OWN_TRANSFER_OUT: 'ownTransfer',
} as const satisfies Record<keyof typeof movementType, IconConcept>;

/** Icono de cada tono de alerta. */
export const toneIcon = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'info',
} as const satisfies Record<Tone, IconConcept>;
