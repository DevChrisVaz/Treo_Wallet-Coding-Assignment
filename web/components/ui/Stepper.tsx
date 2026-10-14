/**
 * Indicador de pasos del flujo de transferencia (WEB-30): barras y "Paso n de m · Etiqueta". El paso
 * se anuncia una sola vez, por la región `aria-live` (sin una etiqueta de grupo que lo repita, R40).
 */
export function Stepper({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-pill ${index < current ? 'bg-action' : 'bg-border'}`}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-caption text-fg-muted">
        Paso {current} de {total} · {label}
      </p>
    </div>
  );
}
