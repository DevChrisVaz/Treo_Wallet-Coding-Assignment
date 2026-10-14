'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
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
 * componente aparte para que el rediseño de la pantalla de movimientos lo reubique sin cambiarlo.
 */
export function StatementDownload({ accountId }: { accountId: string }) {
  const headingId = useId();
  // Las opciones se calculan una vez, al montar, con la fecha de la Ciudad de México.
  const [months] = useState(() => statementMonths(new Date()));
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
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="text-h3">
        Estado de cuenta
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
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
    </section>
  );
}
