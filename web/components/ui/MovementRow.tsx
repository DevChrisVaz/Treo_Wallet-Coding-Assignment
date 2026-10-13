import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { MONEY_CLASSES, MOVEMENT_TYPE } from '@/lib/conventions';
import { formatDateTime } from '@/lib/format';
import { signedAmount } from '@/lib/money';

/**
 * Fila del historial (D7 de design-system): tipo, contraparte, concepto, referencia, fecha, monto
 * con signo y color por dirección (DSG-09) y saldo después del movimiento (WEB-14).
 */
export function MovementRow({ movement }: { movement: Movement }) {
  const { direction, label } = MOVEMENT_TYPE[movement.type];
  const detail = [movement.counterparty?.name, movement.concept].filter(Boolean).join(' · ');

  return (
    <li className="flex items-start justify-between gap-4 border-b border-border py-3">
      <div className="grid min-w-0 gap-0.5">
        <p className="text-label text-fg">{label}</p>
        <p className="text-body-sm text-fg-secondary">{detail}</p>
        <p className="text-caption text-fg-muted">
          <time dateTime={movement.occurredAt}>{formatDateTime(movement.occurredAt)}</time>
          {' · '}Ref. {movement.reference}
        </p>
      </div>
      <div className="grid shrink-0 justify-items-end gap-0.5 text-right">
        <p className={`text-label whitespace-nowrap tabular-nums ${MONEY_CLASSES[direction]}`}>
          {signedAmount(direction, movement.amount)}
        </p>
        <p className="text-caption text-fg-muted tabular-nums">
          Saldo: {formatMXN(movement.balanceAfter)}
        </p>
      </div>
    </li>
  );
}
