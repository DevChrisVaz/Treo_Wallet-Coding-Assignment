'use client';

import type { Account } from '@devchrisvaz/wallet-contract';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';

/** Cuánto dura "CLABE copiada" antes de volver a "Copiar CLABE". */
export const COPIED_FEEDBACK_MS = 3000;

export const CLIPBOARD_ERROR = 'No pudimos copiar la CLABE. Selecciónala y cópiala a mano.';

/** CLABE de 18 dígitos en grupos de 4 para leerla; la copia va sin espacios. */
export function groupClabe(clabe: string): string {
  return clabe.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Fila etiqueta / valor de los datos para recibir. */
function DetailRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className="text-right text-label text-balance text-fg">{value}</dd>
    </div>
  );
}

export interface ReceiveSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: readonly Pick<Account, 'id' | 'name' | 'clabe'>[];
  /** Cuenta elegida en Inicio: la que aparece seleccionada al abrir la hoja. */
  initialAccountId: string;
  /** Titular (nombre completo de la sesión); sin él, la fila no se muestra. */
  holder: string | null;
}

/**
 * Hoja "Recibir dinero" (WEB-35): selector de cuenta (grupo de opciones, con la de
 * Inicio preseleccionada), los datos para recibir (Titular, Banco, Cuenta y la CLABE completa en
 * grupos de 4) y "Copiar CLABE", que copia los 18 dígitos y pasa a "CLABE copiada" unos segundos,
 * anunciado en una región `status`. Si el portapapeles no está disponible o falla, avisa y deja la CLABE
 * a la vista. La web no tiene "Compartir" (solo móvil). Es hoja en teléfono y panel centrado en el
 * dashboard, como todo `BottomSheet`.
 */
export function ReceiveSheet({
  open,
  onClose,
  accounts,
  initialAccountId,
  holder,
}: ReceiveSheetProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  const selected =
    accounts.find((account) => account.id === pickedId) ??
    accounts.find((account) => account.id === initialAccountId) ??
    accounts[0];

  useEffect(() => () => clearTimeout(timer.current), []);

  function reset() {
    clearTimeout(timer.current);
    setCopied(false);
    setFailed(false);
  }

  function close() {
    reset();
    setPickedId(null);
    onClose();
  }

  function pick(id: string) {
    reset();
    setPickedId(id);
  }

  // Grupo de opciones: las flechas mueven la selección y el foco; solo la elegida entra con Tab.
  function onRadioKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + accounts.length) % accounts.length;
    const account = accounts[next];
    if (!account) return;
    pick(account.id);
    radios.current[next]?.focus();
  }

  async function copy() {
    if (!selected) return;
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(selected.clabe);
      setFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Sin portapapeles (contexto no seguro) o permiso negado.
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="Recibir dinero">
      {selected ? (
        <div className="grid gap-5">
          <div
            role="radiogroup"
            aria-label="Cuenta"
            className="grid grid-cols-2 gap-1 rounded-md bg-surface-subtle p-1"
          >
            {accounts.map((account, index) => {
              const on = account.id === selected.id;
              return (
                <button
                  key={account.id}
                  ref={(element) => {
                    radios.current[index] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(account.id)}
                  onKeyDown={(event) => onRadioKeyDown(event, index)}
                  className={`min-h-11 rounded-sm px-3 text-label transition-colors ${on ? 'bg-surface text-fg shadow-card' : 'text-fg-secondary hover:text-fg'}`}
                >
                  {account.name}
                </button>
              );
            })}
          </div>
          <dl className="divide-y divide-border">
            {holder ? <DetailRow term="Titular" value={holder} /> : null}
            <DetailRow term="Banco" value="TreoWallet" />
            <DetailRow term="Cuenta" value={selected.name} />
            <div className="grid gap-1 py-3">
              <dt className="text-body-sm text-fg-secondary">CLABE</dt>
              <dd className="text-h3 whitespace-nowrap text-fg tabular-nums">
                {groupClabe(selected.clabe)}
              </dd>
            </div>
          </dl>
          <div className="grid gap-3">
            <Button
              variant={copied ? 'primary' : 'secondary'}
              icon={copied ? 'check' : 'copy'}
              onClick={() => void copy()}
            >
              {copied ? 'CLABE copiada' : 'Copiar CLABE'}
            </Button>
            <p role="status" className="sr-only">
              {copied ? 'CLABE copiada' : ''}
            </p>
            {failed ? <InlineAlert tone="danger">{CLIPBOARD_ERROR}</InlineAlert> : null}
          </div>
          <p className="text-caption text-fg-muted">
            Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.
          </p>
        </div>
      ) : null}
    </BottomSheet>
  );
}
