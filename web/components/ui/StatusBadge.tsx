import type { TransferStatus } from '@devchrisvaz/wallet-contract';
import { TONE_CLASSES, TRANSFER_STATUS } from '@/lib/conventions';

/**
 * Insignia del estado de una transferencia: el color siempre va con su etiqueta (DSG-10). 24 px de
 * alto (4 px arriba y abajo), como la de la app móvil (WEB-25).
 */
export function StatusBadge({ status }: { status: TransferStatus }) {
  const { tone, label } = TRANSFER_STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-caption font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
