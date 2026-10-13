import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmTransfer, createTransfer, resendTransferOtp } from '@/app/actions/transfers';
import { bffGet } from '@/lib/client/bff';
import { pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient, testQueryClient } from '@/test/support/render';
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
const confirmMock = vi.mocked(confirmTransfer);
const resendMock = vi.mocked(resendTransferOtp);
const bffGetMock = vi.mocked(bffGet);

function accountReads(): number {
  return bffGetMock.mock.calls.filter(([path]) => path === 'accounts').length;
}

beforeEach(() => {
  createMock.mockReset();
  confirmMock.mockReset();
  resendMock.mockReset();
  bffGetMock.mockReset();
  mockTransferReads(bffGetMock);
  setLocation('/transfers/new');
});

describe('TransferFlow · flujo completo', () => {
  it('WEB-16 WEB-17 WEB-18 formulario → confirmación → OTP → comprobante', async () => {
    const pending = pendingOtpTransfer();
    const completed = transfer({ amount: '15000.00', requiresOtp: true });
    createMock.mockResolvedValue({ ok: true, data: { transfer: pending, replayed: false } });
    confirmMock
      .mockResolvedValueOnce({
        ok: false,
        problem: problem('OTP_INVALID', { attemptsRemaining: 2 }),
      })
      .mockResolvedValueOnce({ ok: true, data: completed });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />, {
      client: testQueryClient(),
    });

    // Formulario
    await fillTransfer(user, '15,000');

    // Confirmación
    const summary = await screen.findByRole('region', { name: 'Confirma la transferencia' });
    expect(summary).toHaveTextContent('$15,000.00');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ amount: '15000' });

    // OTP: primero un código incorrecto, luego el correcto
    expect(await screen.findByRole('heading', { name: 'Ingresa el código' })).toHaveFocus();
    expect(screen.getByText(/an\*\*\*@example\.com/)).toHaveTextContent('Vence a las 10:52');
    const code = screen.getByLabelText('Código de 6 dígitos');
    await user.type(code, '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Te quedan 2 intentos');
    await user.clear(code);
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Comprobante
    const receipt = await screen.findByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Completada')).toBeVisible();
    expect(receipt).toHaveTextContent('$15,000.00');
    expect(receipt).toHaveTextContent(completed.id);
    expect(confirmMock).toHaveBeenLastCalledWith({ transferId: pending.id, otp: '123456' });
    expect(createMock).toHaveBeenCalledTimes(1);
    // Se vuelven a consultar las cuentas para mostrar el saldo nuevo.
    await waitFor(() => expect(accountReads()).toBeGreaterThanOrEqual(2));
  });

  it('WEB-16 una transferencia sin OTP muestra el comprobante y vuelve a consultar las cuentas', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '5,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('heading', { name: 'Transferencia enviada' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Comprobante' })).toHaveTextContent('$5,000.00');
    expect(confirmMock).not.toHaveBeenCalled();
    await waitFor(() => expect(accountReads()).toBeGreaterThanOrEqual(2));
  });

  it('WEB-16 WEB-17 saldo insuficiente: se anuncia con el saldo disponible y al corregir se envía un intento nuevo', async () => {
    createMock
      .mockResolvedValueOnce({
        ok: false,
        problem: problem('INSUFFICIENT_FUNDS', { transferId: transfer().id }),
      })
      .mockResolvedValueOnce({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '30,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(within(alert).getByText('Saldo insuficiente')).toBeVisible();
    expect(alert).toHaveTextContent(problemMessage('INSUFFICIENT_FUNDS'));
    expect(alert).toHaveTextContent('Saldo disponible en Principal: $25,000.00');

    await user.click(screen.getByRole('button', { name: 'Corregir' }));
    const amount = screen.getByLabelText('Monto');
    await user.clear(amount);
    await user.type(amount, '5,000');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('region', { name: 'Comprobante' })).toHaveTextContent(
      '$5,000.00',
    );
    const [first, second] = createMock.mock.calls;
    expect(first?.[0]).toMatchObject({ amount: '30000' });
    expect(second?.[0]).toMatchObject({ amount: '5000' });
    expect(second?.[1]).not.toBe(first?.[1]);
  });

  it('WEB-18 al agotar los intentos ofrece iniciar una transferencia nueva desde cero', async () => {
    createMock.mockResolvedValue({
      ok: true,
      data: { transfer: pendingOtpTransfer(), replayed: false },
    });
    confirmMock.mockResolvedValue({ ok: false, problem: problem('OTP_ATTEMPTS_EXHAUSTED') });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '15,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      problemMessage('OTP_ATTEMPTS_EXHAUSTED'),
    );
    await user.click(screen.getByRole('button', { name: 'Iniciar una nueva transferencia' }));
    expect(screen.getByLabelText('Monto')).toHaveValue('');
  });
});
