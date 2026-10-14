'use client';

import { formatMXN, type ScheduledTransferList, type Transfer } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { cancelTransfer } from '@/app/actions/scheduled-transfers';
import { focusPageTitle } from '@/components/layout/page-title';
import { ErrorState, LoadingState } from '@/components/states/states';
import { Button, buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ListSection } from '@/components/ui/ListSection';
import { describeError, describeProblem } from '@/lib/client/problem-messages';
import { queryKeys } from '@/lib/client/query-keys';
import { scheduledTransfersKey, useScheduledTransfers } from '@/lib/client/scheduled-transfers';
import { SCHEDULED_TRANSFERS_PATH, loginPath } from '@/lib/navigation';
import { formatScheduledInstant } from '@/lib/scheduled-date';

/*
 * Página "Programadas" (WEB-34, D11 de scheduled-transfers): lista de `listScheduledTransfers` por
 * el proxy de lecturas y cancelación con confirmación en un diálogo accesible. Va dentro de AppShell,
 * que da el h1 "Transferencias programadas" y, en el dashboard, la acción "Nueva transferencia"
 * (`appSection`); la pantalla no repite el título (un h1 por página, WEB-23).
 */

const PATH = SCHEDULED_TRANSFERS_PATH;
const CANCELLED_MESSAGE = 'Transferencia cancelada';
/** Respuestas que significan que la transferencia ya no está en la lista: se vuelve a cargar. */
const GONE_CODES = new Set(['TRANSFER_NOT_CANCELLABLE', 'NOT_FOUND']);

function destinationOf(transfer: Transfer): string {
  return `${transfer.destination.displayName} •••• ${transfer.destination.clabeLast4}`;
}

function dateOf(transfer: Transfer): string {
  return transfer.scheduledFor ? formatScheduledInstant(transfer.scheduledFor) : '';
}

/** Elementos que reciben foco con Tab dentro del diálogo. */
function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface CancelDialogProps {
  transfer: Transfer;
  cancelling: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmación de la cancelación (patrón de diálogo modal de WAI-ARIA): el foco entra en "Volver",
 * Tab y Shift+Tab no salen del diálogo, Escape lo cierra y quien lo abrió devuelve el foco al botón.
 * Tiene la forma de la hoja inferior del kit (BottomSheet: abajo en teléfono, centrada en el
 * dashboard), pero no la usa: necesita la descripción, `aria-busy` y el foco inicial en "Volver".
 */
function CancelDialog({ transfer, cancelling, error, onConfirm, onClose }: CancelDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  // Mientras se cancela los botones se deshabilitan: el foco se queda en el diálogo.
  useEffect(() => {
    if (cancelling) dialogRef.current?.focus();
  }, [cancelling]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = focusableIn(dialogRef.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    // El foco puede estar en algo que no entra con Tab (el diálogo o su alerta): también da vuelta.
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey ? index <= 0 : index === -1 || index === focusable.length - 1) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-hero/60 dashboard:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={cancelling || undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // Como el panel de BottomSheet: los mismos rellenos, el asa en teléfono y el título en una fila
        // de 44 px; hasta 85 % del alto y, bajo el título fijo, el resto se desplaza (texto al 200 %).
        className="flex max-h-[85dvh] w-full max-w-app flex-col gap-4 rounded-t-lg bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-sheet focus-visible:outline-none dashboard:max-w-md dashboard:rounded-lg dashboard:pb-6"
      >
        <div
          aria-hidden="true"
          className="mx-auto h-1 w-10 shrink-0 rounded-pill bg-border dashboard:hidden"
        />
        <h2 id={titleId} className="flex min-h-11 shrink-0 items-center text-h3 text-fg">
          ¿Cancelar la transferencia programada?
        </h2>
        <div className="grid min-h-0 gap-5 overflow-y-auto">
          <p id={descriptionId} className="text-body text-fg-secondary">
            Transferencia de {formatMXN(transfer.amount)} a {destinationOf(transfer)}, programada
            para el {dateOf(transfer)}. Si la cancelas, no se enviará.
          </p>
          {error ? (
            <InlineAlert tone="danger" focusOnMount>
              {error}
            </InlineAlert>
          ) : null}
          <div className="grid gap-3 dashboard:flex dashboard:flex-wrap">
            <Button
              variant="destructive"
              loading={cancelling}
              loadingLabel="Cancelando…"
              onClick={onConfirm}
            >
              Cancelar transferencia
            </Button>
            <Button ref={backRef} variant="secondary" disabled={cancelling} onClick={onClose}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Transferencias programadas con su cancelación (WEB-34) y estados de carga, error y vacío (WEB-20). */
export function ScheduledTransfersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scheduled = useScheduledTransfers();
  const [target, setTarget] = useState<Transfer | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Candado síncrono: un segundo clic llega antes de que React vuelva a pintar el botón.
  const inFlight = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  function openDialog(transfer: Transfer, event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    setAnnouncement('');
    setPageError(null);
    setDialogError(null);
    setTarget(transfer);
  }

  /** "Volver" o Escape: no cancela y devuelve el foco al botón "Cancelar". */
  function closeDialog() {
    if (inFlight.current) return;
    opener.current?.focus();
    setTarget(null);
  }

  async function confirmCancel() {
    if (inFlight.current || !target) return;
    inFlight.current = true;
    setCancelling(true);
    setDialogError(null);
    try {
      const result = await cancelTransfer({ transferId: target.id });
      if (result.ok) {
        queryClient.setQueryData<ScheduledTransferList>(scheduledTransfersKey, (list) =>
          list ? { ...list, items: list.items.filter((item) => item.id !== target.id) } : list,
        );
        queryClient.setQueryData(queryKeys.transfer(target.id), result.data);
        void queryClient.invalidateQueries({ queryKey: scheduledTransfersKey });
        setTarget(null);
        setAnnouncement(CANCELLED_MESSAGE);
        // El botón que abrió el diálogo ya no existe: el foco va al h1 visible del shell; la región
        // polite anuncia "Transferencia cancelada".
        focusPageTitle();
        return;
      }
      const { problem } = result;
      if (problem.status === 401) {
        router.replace(loginPath(PATH, 'expired'));
        return;
      }
      if (GONE_CODES.has(problem.code)) {
        // Ya se ejecutó o cambió de estado: se explica y la lista se vuelve a cargar.
        setTarget(null);
        setPageError(describeProblem(problem));
        void queryClient.invalidateQueries({ queryKey: scheduledTransfersKey });
        return;
      }
      setDialogError(describeProblem(problem));
    } catch (error) {
      // Cancelar es idempotente: reintentar desde el mismo diálogo es seguro.
      setDialogError(describeError(error));
    } finally {
      inFlight.current = false;
      setCancelling(false);
    }
  }

  return (
    <>
      {/* La región de anuncio existe siempre (WEB-23); vacía queda fuera del flujo y no suma espacio.
          A la vista, el aviso de éxito del kit, sin rol propio: lo anuncia esta región. */}
      <div role="status" aria-live="polite" className={announcement ? undefined : 'sr-only'}>
        {announcement ? (
          <InlineAlert tone="success" announce={false}>
            {announcement}
          </InlineAlert>
        ) : null}
      </div>
      {pageError ? (
        <InlineAlert tone="danger" focusOnMount>
          {pageError}
        </InlineAlert>
      ) : null}

      {scheduled.isPending ? (
        <LoadingState label="Cargando tus transferencias programadas" />
      ) : scheduled.isError ? (
        <ErrorState
          title="No pudimos cargar tus transferencias programadas"
          error={scheduled.error}
          onRetry={() => void scheduled.refetch()}
        />
      ) : scheduled.data.items.length === 0 ? (
        <EmptyState
          icon="scheduled"
          title="No tienes transferencias programadas"
          description='Al hacer una transferencia, elige "Programar" en "Cuándo" para enviarla en otra fecha.'
          action={
            <Link href="/transfers/new" className={buttonClasses('secondary')}>
              Programar una transferencia
            </Link>
          }
        />
      ) : (
        <>
          {/* En escritorio la acción vive en la barra superior (WEB-26). */}
          <Link href="/transfers/new" className={buttonClasses('primary', 'dashboard:hidden')}>
            Nueva transferencia
          </Link>
          <ListSection>
            <ul aria-label="Transferencias programadas" className="divide-y divide-border">
              {scheduled.data.items.map((transfer) => (
                <li
                  key={transfer.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="grid min-w-0 gap-1">
                    <p className="text-label text-fg">
                      {transfer.scheduledFor ? (
                        <time dateTime={transfer.scheduledFor}>{dateOf(transfer)}</time>
                      ) : null}
                    </p>
                    <p className="text-h3 text-fg tabular-nums">{formatMXN(transfer.amount)}</p>
                    <p className="text-body-sm text-fg-secondary">{destinationOf(transfer)}</p>
                    <p className="text-caption text-fg-muted">{transfer.concept}</p>
                  </div>
                  <Button
                    variant="secondary"
                    aria-label={`Cancelar la transferencia de ${formatMXN(transfer.amount)} a ${transfer.destination.displayName} del ${dateOf(transfer)}`}
                    onClick={(event) => openDialog(transfer, event)}
                  >
                    Cancelar
                  </Button>
                </li>
              ))}
            </ul>
          </ListSection>
        </>
      )}

      {target ? (
        <CancelDialog
          transfer={target}
          cancelling={cancelling}
          error={dialogError}
          onConfirm={() => void confirmCancel()}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
}
