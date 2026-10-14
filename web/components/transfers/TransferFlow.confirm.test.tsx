import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransfer } from '@/app/actions/transfers';
import { bffGet } from '@/lib/client/bff';
import { BENEFICIARY, PRINCIPAL, pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { fillTransfer, mockTransferReads } from '@/test/support/transfer-flow';
import { TransferFlow } from './TransferFlow';

vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const createMock = vi.mocked(createTransfer);
const bffGetMock = vi.mocked(bffGet);

const REQUEST = {
  fromAccountId: PRINCIPAL.id,
  destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
  amount: '5000',
  concept: 'Renta',
  reference: '1',
};

beforeEach(() => {
  createMock.mockReset();
  bffGetMock.mockReset();
  mockTransferReads(bffGetMock);
  setLocation('/transfers/new');
});

function keysSent(): unknown[] {
  return createMock.mock.calls.map(([, key]) => key);
}

describe('TransferFlow · confirmación', () => {
  it('WEB-16 muestra el resumen antes de enviar', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user);

    const summary = await screen.findByRole('region', { name: 'Revisa tu transferencia' });
    expect(summary).toHaveTextContent('$5,000.00');
    expect(summary).toHaveTextContent('Principal · •••• 9719');
    expect(summary).toHaveTextContent('Luis · •••• 9735');
    expect(summary).toHaveTextContent('Renta');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('WEB-30 WEB-17 con doble clic en "Enviar" en la revisión crea una sola transferencia y el botón indica que se envía', async () => {
    createMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);

    await user.dblClick(await screen.findByRole('button', { name: 'Enviar' }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(REQUEST, expect.stringMatching(/^[0-9a-f-]{36}$/));
    const sending = screen.getByRole('button', { name: 'Enviando…' });
    expect(sending).toBeDisabled();
    expect(sending).toHaveAttribute('aria-busy', 'true');
  });

  it('WEB-17 ante un error de red, "Reintentar" reenvía con la misma llave', async () => {
    createMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    createMock.mockResolvedValueOnce({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    // R37: el estado sin confirmar es un aviso (`status`), con el texto de la historia aprobada.
    expect(
      await screen.findByText('No pudimos confirmar el estado de tu transferencia'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(keysSent()[1]).toBe(keysSent()[0]);
  });

  it('WEB-17 ante un 5xx reintenta con la misma llave y, si la API responde 200 con Idempotent-Replayed, muestra el estado actual', async () => {
    createMock.mockResolvedValueOnce({
      ok: false,
      problem: problem('INTERNAL_ERROR', { status: 503 }),
    });
    createMock.mockResolvedValueOnce({
      ok: true,
      data: { transfer: pendingOtpTransfer(), replayed: true },
    });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '15,000');

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(keysSent()[1]).toBe(keysSent()[0]);
    expect(
      await screen.findByText('Ya habíamos recibido esta transferencia; este es su estado actual.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Confirma con tu código' })).toBeVisible();
  });

  it('WEB-16 WEB-23 ante saldo insuficiente anuncia "Saldo insuficiente" con el saldo disponible y mueve el foco', async () => {
    createMock.mockResolvedValue({
      ok: false,
      problem: problem('INSUFFICIENT_FUNDS', { transferId: transfer().id }),
    });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '30,000');

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Saldo insuficiente')).toBeVisible();
    expect(alert).toHaveTextContent(problemMessage('INSUFFICIENT_FUNDS'));
    expect(alert).toHaveTextContent('Saldo disponible en Principal: $25,000.00');
    expect(alert).toHaveFocus();
  });

  it('WEB-17 tras el rechazo, corregir el monto envía con una llave distinta', async () => {
    createMock.mockResolvedValueOnce({ ok: false, problem: problem('INSUFFICIENT_FUNDS') });
    createMock.mockResolvedValueOnce({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '30,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    await user.click(await screen.findByRole('button', { name: 'Corregir' }));
    const amount = screen.getByLabelText('Monto');
    expect(amount).toHaveValue('30,000');
    await user.clear(amount);
    await user.type(amount, '5,000');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1]?.[0]).toMatchObject({ amount: '5000' });
    expect(keysSent()[1]).not.toBe(keysSent()[0]);
  });

  it('WEB-17 editar desde la confirmación descarta la llave: el envío usa la del intento nuevo', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    let issued = 0;
    const generateKey = () => {
      issued += 1;
      return `00000000-0000-4000-8000-00000000000${issued}`;
    };
    const user = userEvent.setup();
    renderWithClient(<TransferFlow generateKey={generateKey} />);
    await fillTransfer(user);

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(keysSent()).toEqual(['00000000-0000-4000-8000-000000000002']);
  });

  it('WEB-19 ante DAILY_LIMIT_EXCEEDED indica cuánto puede enviar hoy', async () => {
    createMock.mockResolvedValue({
      ok: false,
      problem: problem('DAILY_LIMIT_EXCEEDED', { remaining: '2000.00' }),
    });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Superaste tu límite diario');
    expect(alert).toHaveTextContent('Hoy puedes enviar hasta $2,000.00');
  });

  it('WEB-16 ante SAME_ACCOUNT_TRANSFER explica que origen y destino deben ser distintos', async () => {
    createMock.mockResolvedValue({ ok: false, problem: problem('SAME_ACCOUNT_TRANSFER') });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      problemMessage('SAME_ACCOUNT_TRANSFER'),
    );
  });

  it('WEB-23 el aviso de estado sin confirmar recibe el foco, no el título del paso', async () => {
    createMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const warning = (
      await screen.findByText('No pudimos confirmar el estado de tu transferencia')
    ).closest('[role="status"]');
    expect(warning).toHaveFocus();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Estado sin confirmar' }),
    ).not.toHaveFocus();
  });
});
