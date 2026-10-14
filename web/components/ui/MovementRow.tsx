import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { movementIcon } from '@devchrisvaz/wallet-design-tokens';
import { MONEY_CLASSES, MOVEMENT_TYPE } from '@/lib/conventions';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { signedAmount } from '@/lib/money';
import { Avatar } from './Avatar';

export interface MovementRowProps {
  movement: Movement;
  /**
   * Para listas que ya agrupan por día (MovementList, WEB-29): a la vista solo la hora, con la fecha
   * completa para lectores de pantalla, y sin borde propio porque la lista pone los divisores. Por
   * omisión, la fila muestra la fecha completa y su borde inferior, como en las listas planas.
   */
  timeOnly?: boolean;
}

/**
 * Fila del historial (WEB-14, WEB-29): avatar por tipo, tipo, contraparte y concepto, fecha (u hora,
 * con `timeOnly`) y referencia, monto con signo y saldo. Como en la app móvil (WEB-25), el tipo no
 * se corta (pasa a una segunda línea si no cabe junto al monto) y solo la contraparte y el concepto
 * se truncan; una palabra del tipo más ancha que su columna se parte en lugar de pasar por debajo
 * del monto (WEB-24, 320 px). El monto y el saldo bajan a su propia línea, alineados a la derecha,
 * solo cuando junto a ellos no quedan ni 2.5rem para el texto (`basis-10`): al 100 % siguen al lado
 * aun con saldos de siete cifras, y con el texto agrandado (WEB-28, 150-200 %) la fila se reacomoda
 * en lugar de desbordar la página.
 */
export function MovementRow({ movement, timeOnly = false }: MovementRowProps) {
  const { direction, label } = MOVEMENT_TYPE[movement.type];
  const detail = [movement.counterparty?.name, movement.concept].filter(Boolean).join(' · ');

  return (
    <li
      className={`flex flex-wrap items-center gap-3 py-3${timeOnly ? '' : ' border-b border-border'}`}
    >
      <Avatar
        tone={direction === 'in' ? 'success' : 'neutral'}
        icon={movementIcon[movement.type]}
      />
      <div className="grid min-w-0 flex-1 basis-10 gap-1">
        <p className="text-label text-fg [overflow-wrap:anywhere]">{label}</p>
        <p className="truncate text-caption text-fg-secondary">{detail}</p>
        <p className="text-caption text-fg-muted tabular-nums">
          <time dateTime={movement.occurredAt}>
            {timeOnly ? (
              <>
                <span className="sr-only">{`${formatDate(movement.occurredAt)}, `}</span>
                {formatTime(movement.occurredAt)}
              </>
            ) : (
              formatDateTime(movement.occurredAt)
            )}
          </time>
          {' · '}Ref. {movement.reference}
        </p>
      </div>
      <div className="ml-auto grid justify-items-end gap-1 text-right">
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
