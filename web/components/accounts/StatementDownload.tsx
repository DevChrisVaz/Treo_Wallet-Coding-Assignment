'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ListSection } from '@/components/ui/ListSection';
import { Select } from '@/components/ui/Select';
import { bffDownload } from '@/lib/client/bff';
import { describeError } from '@/lib/client/problem-messages';
import { statementMonths } from '@/lib/client/statement-months';

/** El navegador ya tomó el archivo; el object URL se libera después, como hace FileSaver. */
const REVOKE_AFTER_MS = 10_000;

/** Entrega el archivo al navegador con un `<a download>` temporal. */
function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/**
 * Descarga del estado de cuenta (WEB-32, D11 de account-statements): selector con el mes en curso
 * y los 12 anteriores (el anterior por defecto) y "Descargar PDF". La descarga pasa por el proxy del
 * BFF; si falla, el mensaje del código aparece aquí mismo, sin salir de la pantalla. Es un
 * componente aparte para que el rediseño de la pantalla de movimientos lo reubique sin cambiarlo;
 * con el rediseño es una tarjeta del kit (`ListSection` con título), con el mes y el botón a todo lo
 * ancho en teléfono y en una fila en el dashboard (R53).
 */
export function StatementDownload({
  accountId,
  now,
}: {
  accountId: string;
  /** Fecha de referencia de los meses (lienzos con el reloj fijo); por omisión, la actual. */
  now?: Date | undefined;
}) {
  // Las opciones se calculan una vez, al montar, con la fecha de la Ciudad de México.
  const [months] = useState(() => statementMonths(now ?? new Date()));
  const [period, setPeriod] = useState(() => months[1]?.value ?? months[0]?.value ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Candado síncrono: el doble clic llega antes de que el botón se vuelva a renderizar deshabilitado.
  const inFlight = useRef(false);

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const file = await bffDownload(`accounts/${accountId}/statements/${period}`);
      saveFile(file.blob, file.filename);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <ListSection title="Estado de cuenta">
      <div className="grid gap-3">
        <div className="grid gap-3 dashboard:flex dashboard:items-end">
          <div className="dashboard:min-w-56">
            <Select label="Mes" value={period} onChange={(event) => setPeriod(event.target.value)}>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            loading={pending}
            loadingLabel="Descargando…"
            onClick={() => void download()}
          >
            Descargar PDF
          </Button>
        </div>
        {error ? (
          <InlineAlert tone="danger" title="No pudimos descargar el estado de cuenta" focusOnMount>
            {error}
          </InlineAlert>
        ) : null}
      </div>
    </ListSection>
  );
}
