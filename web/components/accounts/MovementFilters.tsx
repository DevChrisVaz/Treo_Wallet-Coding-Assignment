'use client';

import type { MovementType } from '@devchrisvaz/wallet-contract';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { MovementFilters } from '@/lib/client/query-keys';
import { MOVEMENT_TYPE } from '@/lib/conventions';

const TYPE_ORDER = Object.keys(MOVEMENT_TYPE) as MovementType[];
/** Error de "Hasta" cuando el rango está invertido; la API respondería 422 (WEB-14). */
const INVERTED_RANGE = 'Elige una fecha igual o posterior a la de Desde.';

/** Las fechas son `AAAA-MM-DD`, así que se comparan bien como texto. */
export function isInvertedRange(filters: MovementFilters): boolean {
  return filters.from !== '' && filters.to !== '' && filters.from > filters.to;
}

/**
 * Filtros del historial en la hoja inferior (WEB-29): se editan como borrador y se aplican con
 * "Aplicar"; un rango invertido marca "Hasta" y no se aplica (WEB-14).
 */
export function MovementFiltersForm({
  initial,
  onApply,
  onClear,
}: {
  initial: MovementFilters;
  onApply: (filters: MovementFilters) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const inverted = isInvertedRange(draft);

  function toggle(type: MovementType) {
    setDraft((current) => {
      const chosen = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];
      return { ...current, types: TYPE_ORDER.filter((item) => chosen.includes(item)) };
    });
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!inverted) onApply(draft);
      }}
    >
      <div className="grid gap-4 dashboard:grid-cols-2 dashboard:gap-3">
        <TextField
          label="Desde"
          type="date"
          value={draft.from}
          max={draft.to || undefined}
          onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
        />
        <TextField
          label="Hasta"
          type="date"
          value={draft.to}
          min={draft.from || undefined}
          error={inverted ? INVERTED_RANGE : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
        />
      </div>
      <fieldset className="grid">
        <legend className="pb-1 text-label text-fg">Tipo</legend>
        {TYPE_ORDER.map((type) => (
          <label key={type} className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input
              type="checkbox"
              className="size-5 accent-action"
              checked={draft.types.includes(type)}
              onChange={() => toggle(type)}
            />
            {MOVEMENT_TYPE[type].label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3">
        <Button type="submit">Aplicar</Button>
        <Button variant="ghost" onClick={onClear}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}
