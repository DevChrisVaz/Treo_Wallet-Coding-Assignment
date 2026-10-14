import { ProblemError } from '@devchrisvaz/wallet-contract';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { confirmTransfer } from '@/app/actions/transfers';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import { OVERVIEW, PRINCIPAL, pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient, testQueryClient } from '@/test/support/render';
import { ReceiptStep } from './ReceiptStep';
import { TransferDetailScreen } from './TransferDetailScreen';

vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const bffGetMock = vi.mocked(bffGet);
const confirmMock = vi.mocked(confirmTransfer);
const FILTERS = { from: '', to: '', types: [] };

function clientWithData() {
  const client = testQueryClient();
  client.setQueryData(queryKeys.accounts, OVERVIEW);
  client.setQueryData(queryKeys.movements(PRINCIPAL.id, FILTERS), { pages: [], pageParams: [] });
  return client;
}

beforeEach(() => {
  bffGetMock.mockReset();
  confirmMock.mockReset();
  setLocation('/transfers/new');
});

describe('ReceiptStep', () => {
  it('WEB-16 DSG-10 muestra el comprobante con estado, monto, origen, destino, concepto, referencia, fecha e id', () => {
    renderWithClient(
      <ReceiptStep transfer={transfer()} accounts={OVERVIEW.accounts} onRestart={vi.fn()} />,
      { client: clientWithData() },
    );
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Completada')).toHaveClass('bg-success-soft', 'text-success');
    expect(receipt).toHaveTextContent('$5,000.00');
    expect(receipt).toHaveTextContent('Principal · •••• 9719');
    expect(receipt).toHaveTextContent('Luis · •••• 9735');
    expect(receipt).toHaveTextContent('Renta');
    expect(receipt).toHaveTextContent('13 oct 2026, 10:42');
    expect(receipt).toHaveTextContent(transfer().id);
  });

  it('WEB-16 al completarse vuelve a consultar las cuentas y el historial', () => {
    const client = clientWithData();
    renderWithClient(
      <ReceiptStep transfer={transfer()} accounts={OVERVIEW.accounts} onRestart={vi.fn()} />,
      { client },
    );
    expect(client.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.movements(PRINCIPAL.id, FILTERS))?.isInvalidated).toBe(
      true,
    );
  });

  it('WEB-16 una transferencia que no se completó no cambia saldos: no invalida la caché', () => {
    const client = clientWithData();
    renderWithClient(
      <ReceiptStep
        transfer={transfer({
          status: 'REJECTED',
          completedAt: null,
          rejectionReason: 'INSUFFICIENT_FUNDS',
        })}
        accounts={OVERVIEW.accounts}
        onRestart={vi.fn()}
      />,
      { client },
    );
    expect(screen.getByText('Rechazada')).toBeVisible();
    expect(client.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(false);
  });

  it('WEB-33 una programada dice cuándo se enviará con el enlace a las programadas, y no invalida la caché', () => {
    const client = clientWithData();
    renderWithClient(
      <ReceiptStep
        transfer={transfer({ status: 'SCHEDULED', scheduledFor: '2026-10-20', completedAt: null })}
        accounts={OVERVIEW.accounts}
        onRestart={vi.fn()}
      />,
      { client },
    );
    // El título "Transferencia programada" lo da FlowHeader (`receiptTitle`, transfer-steps.test.ts)
    // o el detalle (abajo); el paso no repite un encabezado propio.
    expect(screen.queryByRole('heading', { name: 'Transferencia enviada' })).toBeNull();
    expect(screen.getByText(/Se enviará el 20 de octubre de 2026\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'tus transferencias programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
    expect(client.getQueryState(queryKeys.accounts)?.isInvalidated).toBe(false);
  });

  it('WEB-16 ofrece volver a las cuentas o hacer otra transferencia', async () => {
    const onRestart = vi.fn();
    const user = userEvent.setup();
    renderWithClient(
      <ReceiptStep transfer={transfer()} accounts={OVERVIEW.accounts} onRestart={onRestart} />,
    );
    expect(screen.getByRole('link', { name: 'Ver mis cuentas' })).toHaveAttribute('href', '/');
    await user.click(screen.getByRole('button', { name: 'Hacer otra transferencia' }));
    expect(onRestart).toHaveBeenCalled();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderWithClient(
      <ReceiptStep transfer={transfer()} accounts={OVERVIEW.accounts} onRestart={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TransferDetailScreen', () => {
  function reads(found: unknown) {
    bffGetMock.mockImplementation(async (path: string) => {
      if (path === 'accounts') return OVERVIEW;
      if (path === `transfers/${transfer().id}`) {
        if (found instanceof Error) throw found;
        return found;
      }
      throw new Error(`Lectura inesperada: ${path}`);
    });
  }

  it('WEB-16 muestra el comprobante de una transferencia', async () => {
    reads(transfer());
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    expect(await screen.findByRole('region', { name: 'Comprobante' })).toHaveTextContent(
      '$5,000.00',
    );
  });

  it('WEB-25 WEB-27 el detalle muestra el comprobante y "Ver mis cuentas" en línea, sin tapar las pestañas', async () => {
    reads(transfer());
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    await screen.findByRole('region', { name: 'Comprobante' });
    const back = screen.getByRole('link', { name: 'Ver mis cuentas' });
    expect(back).toHaveAttribute('href', '/');
    expect(back.closest('.fixed')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Hacer otra transferencia' }),
    ).not.toBeInTheDocument();
    // El h1 es del shell: la pantalla solo aporta h2.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  });

  it('WEB-18 una transferencia pendiente pide el código y al confirmarla muestra el comprobante', async () => {
    reads(pendingOtpTransfer());
    confirmMock.mockResolvedValue({ ok: true, data: transfer({ amount: '15000.00' }) });
    const user = userEvent.setup();
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);

    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const receipt = await screen.findByRole('region', { name: 'Comprobante' });
    expect(receipt).toHaveTextContent('$15,000.00');
    expect(within(receipt).getByText('Completada')).toBeVisible();
  });

  it('WEB-23 al confirmar el código en el detalle, el foco va al título del comprobante', async () => {
    reads(pendingOtpTransfer());
    confirmMock.mockResolvedValue({ ok: true, data: transfer({ amount: '15000.00' }) });
    const user = userEvent.setup();
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);

    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('heading', { name: 'Transferencia enviada' })).toHaveFocus();
  });

  // Reemplaza "al abrir el detalle de una transferencia completada, su título no toma el foco"
  // (superseded by WEB-25: la historia aprobada `TransferDetail` no lleva título de paso; la página
  // ya se llama "Transferencia"). El foco sigue sin moverse al abrirla.
  it('WEB-23 WEB-25 al abrir el detalle de una transferencia completada no hay título de paso y el foco no se mueve', async () => {
    reads(transfer());
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    await screen.findByRole('region', { name: 'Comprobante' });
    expect(
      screen.queryByRole('heading', { name: 'Transferencia enviada' }),
    ).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });

  it('WEB-18 WEB-23 al agotar los intentos en el detalle, el título lo dice, la alerta recibe el foco y el comprobante queda "Fallida"', async () => {
    reads(pendingOtpTransfer());
    confirmMock.mockResolvedValue({ ok: false, problem: problem('OTP_ATTEMPTS_EXHAUSTED') });
    const user = userEvent.setup();
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);

    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'La transferencia no se realizó' })).toBeVisible();
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Fallida')).toBeVisible();
  });

  it.each([
    ['SCHEDULED', 'Programada', null],
    ['CANCELLED', 'Cancelada', '2026-10-15T17:00:00.000Z'],
  ] as const)(
    'WEB-34 el comprobante de una %s muestra la fecha programada y la insignia "%s"',
    async (status, label, cancelledAt) => {
      reads(transfer({ status, scheduledFor: '2026-10-20', completedAt: null, cancelledAt }));
      renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
      const receipt = await screen.findByRole('region', { name: 'Comprobante' });
      expect(within(receipt).getByText(label)).toBeVisible();
      expect(receipt).toHaveTextContent('Programada para20 de octubre de 2026');
    },
  );

  // Reemplaza "el detalle de una programada se titula «Transferencia programada»…" (superseded by
  // WEB-25: al abrir el detalle de una transferencia resuelta no hay título de paso, como en la
  // historia aprobada `TransferDetail`). El título se mudó al detalle confirmado aquí (prueba siguiente).
  it('WEB-33 WEB-25 el detalle de una programada dice cuándo se enviará, enlaza a las programadas y no lleva título de paso', async () => {
    reads(transfer({ status: 'SCHEDULED', scheduledFor: '2026-10-20', completedAt: null }));
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    expect(await screen.findByText(/Se enviará el 20 de octubre de 2026\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'tus transferencias programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Programada')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Transferencia programada' }),
    ).not.toBeInTheDocument();
  });

  it('WEB-33 WEB-23 al confirmar en el detalle el código de una programada, "Transferencia programada" toma el foco', async () => {
    reads(pendingOtpTransfer());
    confirmMock.mockResolvedValue({
      ok: true,
      data: transfer({
        amount: '15000.00',
        status: 'SCHEDULED',
        scheduledFor: '2026-10-20',
        completedAt: null,
      }),
    });
    const user = userEvent.setup();
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);

    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('heading', { name: 'Transferencia programada' })).toHaveFocus();
    expect(
      screen.queryByRole('heading', { name: 'Transferencia enviada' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Se enviará el 20 de octubre de 2026\./)).toBeVisible();
  });

  it('WEB-20 si la lectura falla muestra el error con "Reintentar"', async () => {
    reads(new ProblemError(404, { code: 'NOT_FOUND' }));
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar la transferencia');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });
});
