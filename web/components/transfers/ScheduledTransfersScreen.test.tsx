import type { Transfer } from '@devchrisvaz/wallet-contract';
import { ProblemError } from '@devchrisvaz/wallet-contract';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cancelTransfer } from '@/app/actions/scheduled-transfers';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import { AHORRO, problem, transfer } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { ScheduledTransfersScreen } from './ScheduledTransfersScreen';

vi.mock('@/app/actions/scheduled-transfers', () => ({ cancelTransfer: vi.fn() }));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const cancelMock = vi.mocked(cancelTransfer);
const bffGetMock = vi.mocked(bffGet);

function scheduled(overrides: Partial<Transfer>): Transfer {
  return transfer({ status: 'SCHEDULED', completedAt: null, ...overrides });
}

// En el orden de la API (TRF-33): por fecha y, en la misma fecha, por creación.
const RENTA = scheduled({
  id: '5a2c1e0d-9b8a-4f7e-8d6c-1e0d9c8b7a6f',
  amount: '1000.00',
  concept: 'Renta',
  scheduledFor: '2026-10-15',
});
const AHORRO_MES = scheduled({
  id: '6b3d2f1e-0c9b-4a8f-9e7d-2f1e0d9c8b7a',
  kind: 'OWN',
  amount: '250.50',
  concept: 'Ahorro del mes',
  scheduledFor: '2026-10-15',
  destination: {
    type: 'OWN_ACCOUNT',
    accountId: AHORRO.id,
    beneficiaryId: null,
    displayName: 'Ahorro',
    clabeLast4: '9722',
  },
});
const LUZ = scheduled({
  id: '7c4e3a2f-1d0c-4b9a-8f8e-3a2f1e0d9c8b',
  amount: '15000.00',
  concept: 'Luz',
  scheduledFor: '2026-10-20',
});

const CANCEL_RENTA = /^Cancelar la transferencia de \$1,000\.00 a Luis/;

/** Respuestas sucesivas de `transfers/scheduled`; la última se repite. */
function listReads(...lists: Transfer[][]) {
  let call = 0;
  bffGetMock.mockImplementation(async (path: string) => {
    if (path !== 'transfers/scheduled') throw new Error(`Lectura inesperada: ${path}`);
    const items = lists[Math.min(call, lists.length - 1)] ?? [];
    call += 1;
    return { items };
  });
}

function listReadCount(): number {
  return bffGetMock.mock.calls.filter(([path]) => path === 'transfers/scheduled').length;
}

function rowsText(): string[] {
  const list = screen.getByRole('list', { name: 'Transferencias programadas' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

async function openCancelDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: CANCEL_RENTA }));
  return screen.getByRole('dialog', { name: '¿Cancelar la transferencia programada?' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
  cancelMock.mockReset();
  bffGetMock.mockReset();
  setLocation('/transfers/scheduled');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ScheduledTransfersScreen · lista', () => {
  it('WEB-34 muestra las programadas en el orden de la API con su fecha, destino, monto y concepto', async () => {
    listReads([RENTA, AHORRO_MES, LUZ]);
    renderWithClient(<ScheduledTransfersScreen />);

    expect(await screen.findByRole('list', { name: 'Transferencias programadas' })).toBeVisible();
    const [first, second, third] = rowsText();
    expect(first).toContain('15 de octubre de 2026');
    expect(first).toContain('Luis •••• 9735');
    expect(first).toContain('$1,000.00');
    expect(first).toContain('Renta');
    expect(second).toContain('15 de octubre de 2026');
    expect(second).toContain('Ahorro •••• 9722');
    expect(second).toContain('$250.50');
    expect(second).toContain('Ahorro del mes');
    expect(third).toContain('20 de octubre de 2026');
    expect(third).toContain('$15,000.00');
    expect(third).toContain('Luz');
    expect(bffGetMock).toHaveBeenCalledWith('transfers/scheduled');
  });

  it('WEB-34 WEB-20 sin programadas muestra "No tienes transferencias programadas" con una acción', async () => {
    listReads([]);
    renderWithClient(<ScheduledTransfersScreen />);

    expect(
      await screen.findByRole('heading', { name: 'No tienes transferencias programadas' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Programar una transferencia' })).toHaveAttribute(
      'href',
      '/transfers/new',
    );
  });

  it('WEB-20 mientras carga muestra el estado de carga', () => {
    bffGetMock.mockReturnValue(new Promise(() => undefined));
    renderWithClient(<ScheduledTransfersScreen />);
    expect(screen.getByText('Cargando tus transferencias programadas')).toBeInTheDocument();
  });

  it('WEB-20 si la lectura falla muestra el error y "Reintentar" repite la lectura', async () => {
    let call = 0;
    bffGetMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new ProblemError(500, { code: 'INTERNAL_ERROR', requestId: '01JABC' });
      return { items: [RENTA] };
    });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus transferencias programadas');
    // En el ErrorState del kit, "Reintentar" va debajo de la alerta, a todo lo ancho (WEB-25).
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: CANCEL_RENTA })).toBeVisible();
  });

  it('WEB-23 la lista no tiene problemas de accesibilidad', async () => {
    listReads([RENTA, AHORRO_MES, LUZ]);
    const { container } = renderWithClient(<ScheduledTransfersScreen />);
    await screen.findByRole('list', { name: 'Transferencias programadas' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WEB-23 el estado vacío no tiene problemas de accesibilidad', async () => {
    listReads([]);
    const { container } = renderWithClient(<ScheduledTransfersScreen />);
    await screen.findByRole('heading', { name: 'No tienes transferencias programadas' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ScheduledTransfersScreen · cancelar', () => {
  it('WEB-34 el diálogo pide confirmación con el monto, el destino y la fecha, y enfoca "Volver"', async () => {
    listReads([RENTA, LUZ]);
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      'Transferencia de $1,000.00 a Luis •••• 9735, programada para el 15 de octubre de 2026. Si la cancelas, no se enviará.',
    );
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toHaveFocus();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('WEB-34 al confirmar llama a cancelTransfer una sola vez, la quita de la lista y anuncia "Transferencia cancelada"', async () => {
    listReads([RENTA, LUZ], [LUZ]);
    cancelMock.mockResolvedValue({
      ok: true,
      data: { ...RENTA, status: 'CANCELLED', cancelledAt: '2026-10-14T18:00:00.000Z' },
    });
    const user = userEvent.setup();
    const { client } = renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).toHaveBeenCalledWith({ transferId: RENTA.id });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: CANCEL_RENTA })).not.toBeInTheDocument();
    expect(rowsText()).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Transferencia cancelada');
    expect(screen.getByRole('heading', { name: 'Transferencias programadas' })).toHaveFocus();
    // La lista se vuelve a consultar y el comprobante en caché queda como cancelado.
    await waitFor(() => expect(listReadCount()).toBe(2));
    expect(client.getQueryData<Transfer>(queryKeys.transfer(RENTA.id))?.status).toBe('CANCELLED');
  });

  it('WEB-34 con doble clic en la confirmación llama a cancelTransfer una sola vez', async () => {
    listReads([RENTA, LUZ]);
    cancelMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.dblClick(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    expect(cancelMock).toHaveBeenCalledTimes(1);
    const busy = within(dialog).getByRole('button', { name: 'Cancelando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeDisabled();
  });

  it('WEB-34 dos clics antes de que React vuelva a pintar llaman a cancelTransfer una sola vez', async () => {
    listReads([RENTA, LUZ]);
    cancelMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Cancelar transferencia' });
    // En un mismo act el botón sigue habilitado para el segundo clic, como en un navegador lento.
    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  it('WEB-34 WEB-23 "Volver" cierra el diálogo sin cancelar y el foco vuelve al botón "Cancelar"', async () => {
    listReads([RENTA, LUZ]);
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: CANCEL_RENTA })).toHaveFocus();
  });

  it('WEB-34 WEB-23 Escape cierra el diálogo sin cancelar y el foco vuelve al botón "Cancelar"', async () => {
    listReads([RENTA, LUZ]);
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    await openCancelDialog(user);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: CANCEL_RENTA })).toHaveFocus();
  });

  it('WEB-23 el foco queda atrapado en el diálogo con Tab y Shift+Tab', async () => {
    listReads([RENTA, LUZ]);
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Cancelar transferencia' });
    const back = within(dialog).getByRole('button', { name: 'Volver' });

    expect(back).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab({ shift: true });
    expect(back).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('WEB-23 con un error a la vista, Tab y Shift+Tab desde la alerta no salen del diálogo', async () => {
    listReads([RENTA, LUZ]);
    cancelMock.mockResolvedValue({
      ok: false,
      problem: problem('INTERNAL_ERROR', { status: 503 }),
    });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));
    const alert = await within(dialog).findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());

    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toHaveFocus();

    alert.focus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Cancelar transferencia' })).toHaveFocus();
  });

  it('WEB-23 con el teclado: Enter abre el diálogo y Espacio confirma', async () => {
    listReads([RENTA, LUZ], [LUZ]);
    cancelMock.mockResolvedValue({ ok: true, data: { ...RENTA, status: 'CANCELLED' } });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    (await screen.findByRole('button', { name: CANCEL_RENTA })).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Volver' })).toHaveFocus();
    await user.tab();
    await user.keyboard(' ');

    expect(cancelMock).toHaveBeenCalledWith({ transferId: RENTA.id });
    expect(await screen.findByText('Transferencia cancelada')).toBeVisible();
  });

  it('WEB-34 ante 409 TRANSFER_NOT_CANCELLABLE muestra su mensaje y vuelve a cargar la lista, que ya no la incluye', async () => {
    listReads([RENTA, LUZ], [LUZ]);
    cancelMock.mockResolvedValue({
      ok: false,
      problem: problem('TRANSFER_NOT_CANCELLABLE', { status: 409, transferStatus: 'COMPLETED' }),
    });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Esta transferencia ya no se puede cancelar.');
    expect(alert).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: CANCEL_RENTA })).not.toBeInTheDocument(),
    );
    expect(listReadCount()).toBe(2);
    expect(rowsText()).toHaveLength(1);
  });

  it('WEB-34 un error inesperado se muestra en el diálogo, que sigue abierto para reintentar', async () => {
    listReads([RENTA, LUZ], [LUZ]);
    cancelMock
      .mockResolvedValueOnce({ ok: false, problem: problem('INTERNAL_ERROR', { status: 503 }) })
      .mockResolvedValueOnce({ ok: true, data: { ...RENTA, status: 'CANCELLED' } });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(
      'Algo falló de nuestro lado. Intenta de nuevo en unos minutos. Si contactas a soporte, menciona el código 01JABC.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Transferencia cancelada')).toBeVisible();
  });

  it('WEB-34 un fallo de red se muestra en el diálogo sin cerrarlo', async () => {
    listReads([RENTA, LUZ]);
    cancelMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.',
    );
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('WEB-22 si la sesión terminó, lleva al inicio de sesión y vuelve a las programadas', async () => {
    listReads([RENTA, LUZ]);
    cancelMock.mockResolvedValue({
      ok: false,
      problem: problem('UNAUTHENTICATED', { status: 401 }),
    });
    const user = userEvent.setup();
    renderWithClient(<ScheduledTransfersScreen />);

    const dialog = await openCancelDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar transferencia' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        '/login?next=%2Ftransfers%2Fscheduled&reason=expired',
      ),
    );
  });

  it('WEB-23 el diálogo abierto no tiene problemas de accesibilidad', async () => {
    listReads([RENTA, LUZ]);
    const user = userEvent.setup();
    const { container } = renderWithClient(<ScheduledTransfersScreen />);
    await openCancelDialog(user);
    expect(await axe(container)).toHaveNoViolations();
  });
});
