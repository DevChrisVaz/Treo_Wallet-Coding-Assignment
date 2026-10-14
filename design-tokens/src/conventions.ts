/**
 * Convenciones compartidas por web y móvil. Las llaves son strings: el paquete no depende del
 * contrato. Cada cliente comprueba la exhaustividad contra los tipos del contrato
 * (`satisfies Record<TransferStatus, …>`), así que un valor nuevo en el contrato rompe su
 * compilación hasta que se agregue aquí.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type Direction = 'in' | 'out';

/** Insignia de cada estado de transferencia. El color nunca va solo: siempre lleva la etiqueta. */
export const transferStatus = {
  PENDING_OTP: { tone: 'warning', label: 'Pendiente de código' },
  COMPLETED: { tone: 'success', label: 'Completada' },
  REJECTED: { tone: 'danger', label: 'Rechazada' },
  FAILED: { tone: 'danger', label: 'Fallida' },
  EXPIRED: { tone: 'neutral', label: 'Vencida' },
  SCHEDULED: { tone: 'info', label: 'Programada' },
  CANCELLED: { tone: 'neutral', label: 'Cancelada' },
} as const satisfies Record<string, { tone: Tone; label: string }>;

/** Etiqueta y dirección del dinero de cada tipo de movimiento. */
export const movementType = {
  DEPOSIT: { direction: 'in', label: 'Depósito' },
  TRANSFER_IN: { direction: 'in', label: 'Transferencia recibida' },
  TRANSFER_OUT: { direction: 'out', label: 'Transferencia enviada' },
  OWN_TRANSFER_IN: { direction: 'in', label: 'Traspaso recibido' },
  OWN_TRANSFER_OUT: { direction: 'out', label: 'Traspaso enviado' },
} as const satisfies Record<string, { direction: Direction; label: string }>;

/**
 * Signo y token de color por dirección. El monto se muestra como `${sign}${formatMXN(abs)}`, con
 * `formatMXN` del contrato. Las salidas usan la tinta: el rojo queda reservado para errores.
 */
export const money = {
  in: { sign: '+', color: 'money.in' },
  out: { sign: '−', color: 'money.out' },
} as const satisfies Record<Direction, { sign: string; color: string }>;
