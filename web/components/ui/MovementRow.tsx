import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { movementIcon } from '@devchrisvaz/wallet-design-tokens';
import { MONEY_CLASSES, MOVEMENT_TYPE } from '@/lib/conventions';
import { formatDateTime, formatTime } from '@/lib/format';
import { signedAmount } from '@/lib/money';
import { Avatar } from './Avatar';

/**
 * Fila del historial (WEB-14, WEB-29): avatar por tipo, tipo, contraparte y concepto, hora y
 * referencia, monto con signo y saldo. La fecha completa queda para lectores de pantalla: la lista
 * la agrupa visualmente por día.
 */
export function MovementRow({ movement }: { movement: Movement }) {
  const { direction, label } = MOVEMENT_TYPE[movement.type];
  const detail = [movement.counterparty?.name, movement.concept].filter(Boolean).join(' · ');

  const dateTime = formatDateTime(movement.occurredAt);
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar
        tone={direction === 'in' ? 'success' : 'neutral'}
        icon={movementIcon[movement.type]}
      />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate text-label text-fg">{label}</p>
        <p className="truncate text-caption text-fg-secondary">{detail}</p>
        <p className="text-caption text-fg-muted">
          <time dateTime={movement.occurredAt}>
            <span className="sr-only">{dateTime.slice(0, dateTime.lastIndexOf(',') + 2)}</span>
            {formatTime(movement.occurredAt)}
          </time>
          {' · '}Ref. {movement.reference}
        </p>
      </div>
      <div className="grid shrink-0 justify-items-end gap-0.5 text-right">
        <p className={`text-label whitespace-nowrap tabular-nums ${MONEY_CLASSES[direction]}`}>
          {signedAmount(direction, movement.amount)}
        </p>
        <p className="text-caption text-fg-muted tabular-nums">
          Saldo {formatMXN(movement.balanceAfter)}
        </p>
      </div>
    </li>
  );
}
