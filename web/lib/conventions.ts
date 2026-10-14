import type { MovementType, TransferStatus } from '@devchrisvaz/wallet-contract';
import {
  money,
  movementType,
  transferStatus,
  type Direction,
  type Tone,
} from '@devchrisvaz/wallet-design-tokens';

/*
 * El paquete de diseño no depende del contrato: aquí se comprueba que cubre cada estado y cada tipo
 * del contrato. Si el contrato agrega uno, el typecheck falla hasta que el paquete lo incluya.
 */
export const TRANSFER_STATUS = transferStatus satisfies Record<
  TransferStatus,
  { tone: Tone; label: string }
>;
export const MOVEMENT_TYPE = movementType satisfies Record<
  MovementType,
  { direction: Direction; label: string }
>;
export const MONEY = money;

/** Clases de cada tono (insignias y alertas). Literales completos para que Tailwind las genere. */
export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
};

/** Color del monto por dirección: la salida usa la tinta, nunca el color de error (DSG-09). */
export const MONEY_CLASSES: Record<Direction, string> = {
  in: 'text-money-in',
  out: 'text-money-out',
};
