import type { Movement } from '@devchrisvaz/wallet-contract';
import { groupByDay } from '@devchrisvaz/wallet-design-tokens';
import { MovementRow } from './MovementRow';

/** Movimientos agrupados por día de Ciudad de México (WEB-29): cada fila, solo con la hora. */
export function MovementList({ movements, now }: { movements: readonly Movement[]; now?: Date }) {
  return (
    <div className="grid gap-2">
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="pt-2 pb-1 text-caption font-medium text-fg-muted">{group.label}</h3>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <MovementRow key={item.id} movement={item} timeOnly />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
