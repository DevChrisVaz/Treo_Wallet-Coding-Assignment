import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    const summary = await screen.findByRole('region', { name: 'Confirma la transferencia' });
    expect(summary).toHaveTextContent('$5,000.00');
    expect(summary).toHaveTextContent('Principal •••• 9719');
    expect(summary).toHaveTextContent('Luis •••• 9735');
    expect(summary).toHaveTextContent('Renta');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('WEB-17 con doble clic en "Enviar" envía una sola transferencia y el botón indica que se envía', async () => {
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
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No sabemos si la transferencia se envió',
    );
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
    expect(screen.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible();
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
});

describe('TransferFlow · confirmación de una programada', () => {
  // 14 de octubre de 2026, 12:00 en la Ciudad de México.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const SCHEDULED_REQUEST = { ...REQUEST, amount: '1000', scheduledFor: '2026-10-20' };
  const scheduled = () => transfer({ status: 'SCHEDULED', scheduledFor: '2026-10-20' });

  it('WEB-33 la revisión dice "Se enviará el 20 de octubre de 2026"', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '1,000', '2026-10-20');

    const summary = await screen.findByRole('region', { name: 'Confirma la transferencia' });
    expect(summary).toHaveTextContent('Se enviará el 20 de octubre de 2026');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('WEB-16 una transferencia inmediata no dice cuándo se enviará', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    const summary = await screen.findByRole('region', { name: 'Confirma la transferencia' });
    expect(summary).not.toHaveTextContent('Se enviará el');
  });

  it('WEB-33 WEB-17 con doble clic al programar envía una sola creación con scheduledFor y su llave', async () => {
    createMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '1,000', '2026-10-20');

    await user.dblClick(await screen.findByRole('button', { name: 'Enviar' }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      SCHEDULED_REQUEST,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  });

  it('WEB-33 WEB-17 dos clics en "Enviar" antes de que React vuelva a pintar envían una sola programación', async () => {
    createMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '1,000', '2026-10-20');
    const send = await screen.findByRole('button', { name: 'Enviar' });

    // En un mismo act el botón sigue habilitado para el segundo clic: solo el candado lo detiene.
    act(() => {
      send.click();
      send.click();
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      SCHEDULED_REQUEST,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
  });

  it('WEB-33 WEB-17 tras un error de red, "Reintentar" reenvía la programación con la misma llave', async () => {
    createMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    createMock.mockResolvedValueOnce({ ok: true, data: { transfer: scheduled(), replayed: true } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '1,000', '2026-10-20');

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1]?.[0]).toEqual(SCHEDULED_REQUEST);
    expect(keysSent()[1]).toBe(keysSent()[0]);
    expect(await screen.findByRole('heading', { name: 'Transferencia programada' })).toBeVisible();
  });

  it('WEB-33 ante SCHEDULED_LIMIT_REACHED muestra el texto del paquete de diseño', async () => {
    createMock.mockResolvedValue({ ok: false, problem: problem('SCHEDULED_LIMIT_REACHED') });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '1,000', '2026-10-20');

    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Llegaste al máximo de 20 transferencias programadas. Cancela alguna para programar otra.',
    );
    expect(alert).toHaveFocus();
  });

  it.each([
    [
      '/scheduledFor',
      'DATE_OUT_OF_RANGE',
      'Fecha de envío',
      'Elige una fecha entre mañana y 90 días después de hoy',
    ],
    [
      '/amount',
      'TOO_LARGE',
      'Monto',
      'Una transferencia programada a un tercero no puede superar el límite diario de $50,000.00',
    ],
  ] as const)(
    'WEB-33 WEB-17 un error de la API en %s (%s) vuelve al formulario con el error junto al campo y el siguiente envío usa otra llave',
    async (pointer, code, label, message) => {
      createMock.mockResolvedValueOnce({
        ok: false,
        problem: problem('VALIDATION_FAILED', { errors: [{ pointer, code, message }] }),
      });
      createMock.mockResolvedValueOnce({
        ok: true,
        data: { transfer: scheduled(), replayed: false },
      });
      const user = userEvent.setup();
      renderWithClient(<TransferFlow />);
      await fillTransfer(user, '1,000', '2026-10-20');

      await user.click(await screen.findByRole('button', { name: 'Enviar' }));

      const field = await screen.findByLabelText(label);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
      await waitFor(() => expect(field).toHaveFocus());

      await user.click(screen.getByRole('button', { name: 'Continuar' }));
      await user.click(await screen.findByRole('button', { name: 'Enviar' }));
      expect(createMock).toHaveBeenCalledTimes(2);
      expect(keysSent()[1]).not.toBe(keysSent()[0]);
    },
  );
});
