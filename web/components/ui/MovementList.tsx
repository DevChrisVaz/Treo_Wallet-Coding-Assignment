import type { Movement } from '@devchrisvaz/wallet-contract';
import { groupByDay } from '@devchrisvaz/wallet-design-tokens';
import { MovementRow } from './MovementRow';

/**
 * Movimientos agrupados por día de Ciudad de México (WEB-29): cada fila, solo con la hora. Los días
 * no son regiones (un landmark por día saturaría la navegación por regiones, WEB-23): cada uno es
 * su encabezado y su lista.
 */
export function MovementList({
  movements,
  now,
  headingLevel = 3,
}: {
  movements: readonly Movement[];
  now?: Date;
  /**
   * 3 dentro de una tarjeta con título (Inicio); 2 cuando la lista va directo bajo el h1
   * (Movimientos).
   */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="grid gap-2">
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <div key={group.key}>
          <Heading className="pt-2 pb-1 text-caption font-medium text-fg-muted">
            {group.label}
          </Heading>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <MovementRow key={item.id} movement={item} timeOnly />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
