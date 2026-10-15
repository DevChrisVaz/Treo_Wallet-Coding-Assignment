import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { confirmTransfer, resendTransferOtp } from '@/app/actions/transfers';
import { OVERVIEW, pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { EndedStep, OtpStep } from './OtpStep';

vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const confirmMock = vi.mocked(confirmTransfer);
const resendMock = vi.mocked(resendTransferOtp);
const PENDING = pendingOtpTransfer();

function renderStep(pending = PENDING) {
  const onConfirmed = vi.fn();
  const onEnded = vi.fn();
  const view = render(<OtpStep transfer={pending} onConfirmed={onConfirmed} onEnded={onEnded} />);
  return { ...view, onConfirmed, onEnded, user: userEvent.setup() };
}

async function submitCode(user: ReturnType<typeof userEvent.setup>, code = '123456') {
  await user.type(screen.getByLabelText('Código de 6 dígitos'), code);
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
}

beforeEach(() => {
  confirmMock.mockReset();
  resendMock.mockReset();
  setLocation('/transfers/new');
});

describe('OtpStep', () => {
  it('WEB-16 indica el destino enmascarado del código y la hora de expiración', () => {
    renderStep();
    expect(
      screen.getByText('Te enviamos un código de 6 dígitos a an***@example.com.'),
    ).toBeVisible();
    expect(screen.getByText('Vence a las 10:52.')).toBeVisible();
  });

  it('WEB-18 con el código correcto confirma la transferencia', async () => {
    confirmMock.mockResolvedValue({ ok: true, data: transfer() });
    const { user, onConfirmed } = renderStep();

    await submitCode(user);

    expect(confirmMock).toHaveBeenCalledWith({ transferId: PENDING.id, otp: '123456' });
    expect(onConfirmed).toHaveBeenCalledWith(transfer());
  });

  it('WEB-18 con doble clic en "Confirmar" envía una sola confirmación con el botón deshabilitado', async () => {
    confirmMock.mockReturnValue(new Promise(() => undefined));
    const { user } = renderStep();
    await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456');

    await user.dblClick(screen.getByRole('button', { name: 'Confirmar' }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled();
  });

  it('WEB-40 ante un 429 al confirmar muestra el mensaje con la espera y la transferencia sigue pendiente', async () => {
    confirmMock.mockResolvedValue({
      ok: false,
      problem: problem('RATE_LIMITED', { status: 429, retryAfter: 120 }),
    });
    const { user, onEnded, onConfirmed } = renderStep();

    await submitCode(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('RATE_LIMITED'));
    expect(alert).toHaveTextContent('Intenta de nuevo en 2 minutos.');
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('WEB-40 ante un 429 al reenviar el código muestra el mensaje con la espera y no reenvía sola', async () => {
    resendMock.mockResolvedValue({
      ok: false,
      problem: problem('RATE_LIMITED', { status: 429, retryAfter: 60 }),
    });
    const { user, onEnded } = renderStep();

    await user.click(screen.getByRole('button', { name: /Reenviar/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('RATE_LIMITED'));
    expect(alert).toHaveTextContent('Intenta de nuevo en 1 minuto.');
    expect(resendMock).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('WEB-18 un código incorrecto muestra los intentos restantes', async () => {
    confirmMock.mockResolvedValue({
      ok: false,
      problem: problem('OTP_INVALID', { attemptsRemaining: 1 }),
    });
    const { user, onEnded } = renderStep();

    await submitCode(user, '000000');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('OTP_INVALID'));
    expect(alert).toHaveTextContent('Te queda 1 intento');
    expect(alert).toHaveFocus();
    expect(onEnded).not.toHaveBeenCalled();
  });

  it.each([
    'OTP_ATTEMPTS_EXHAUSTED',
    'TRANSFER_EXPIRED',
    'DAILY_LIMIT_EXCEEDED',
    'INSUFFICIENT_FUNDS',
  ] as const)('WEB-18 %s termina el intento', async (code) => {
    const ended = problem(code, { status: code === 'TRANSFER_EXPIRED' ? 409 : 422 });
    confirmMock.mockResolvedValue({ ok: false, problem: ended });
    const { user, onEnded } = renderStep();

    await submitCode(user);

    expect(onEnded).toHaveBeenCalledWith(ended);
  });

  it('WEB-18 si el envío del correo falló, ofrece reenviar el código', async () => {
    resendMock.mockResolvedValue({
      ok: true,
      data: { ...PENDING.otp!, deliveryStatus: 'SENT', resendsRemaining: 2 },
    });
    const { user } = renderStep(
      pendingOtpTransfer({ otp: { ...PENDING.otp!, deliveryStatus: 'FAILED' } }),
    );

    expect(screen.getByRole('status')).toHaveTextContent('No pudimos enviarte el código');
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(resendMock).toHaveBeenCalledWith({ transferId: PENDING.id });
    expect(await screen.findByText('Te enviamos un código nuevo.')).toBeVisible();
  });

  it('WEB-18 sin reenvíos disponibles no ofrece reenviar; RESEND_LIMIT_REACHED se anuncia', async () => {
    resendMock.mockResolvedValue({ ok: false, problem: problem('RESEND_LIMIT_REACHED') });
    const { user, unmount } = renderStep();
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      problemMessage('RESEND_LIMIT_REACHED'),
    );
    expect(screen.queryByRole('button', { name: 'Reenviar código' })).not.toBeInTheDocument();
    unmount();

    renderStep(pendingOtpTransfer({ otp: { ...PENDING.otp!, resendsRemaining: 0 } }));
    expect(screen.queryByRole('button', { name: 'Reenviar código' })).not.toBeInTheDocument();
  });

  it('WEB-07 un código que no tiene 6 dígitos no se envía', async () => {
    const { user } = renderStep();
    await submitCode(user, '12');
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveAttribute('aria-invalid', 'true');
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('WEB-22 si la sesión terminó, lleva al inicio de sesión', async () => {
    confirmMock.mockResolvedValue({
      ok: false,
      problem: problem('UNAUTHENTICATED', { status: 401 }),
    });
    const { user } = renderStep();
    await submitCode(user);
    expect(router.replace).toHaveBeenCalledWith(
      `/login?next=%2Ftransfers%2F${PENDING.id}&reason=expired`,
    );
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderStep();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WEB-30 el monto es el protagonista del paso de código, con los intentos que quedan', async () => {
    confirmMock.mockResolvedValue({
      ok: false,
      problem: problem('OTP_INVALID', { attemptsRemaining: 2 }),
    });
    const { user } = renderStep();
    expect(screen.getByText('$15,000.00')).toBeVisible();
    expect(screen.getByText('Para Luis · CLABE •••• 9735')).toBeVisible();
    expect(screen.getByText('Te quedan 3 intentos.')).toBeVisible();
    await submitCode(user, '000000');
    expect(await screen.findByText('Te quedan 2 intentos.')).toBeVisible();
  });

  it('WEB-25 WEB-30 las acciones van a la distancia de los bloques del paso y el texto con el campo en su propia pila, como la historia', () => {
    renderStep();
    const field = screen.getByLabelText('Código de 6 dígitos');
    // Historia `TransferOtp`: el paso separa sus bloques con gap-5 (en el dashboard las acciones van
    // en línea, a 20 px del campo); el aviso, los datos del código y el campo van con gap-4.
    expect(field.closest('form')).toHaveClass('grid', 'gap-5');
    const stack = screen.getByText(
      'Te enviamos un código de 6 dígitos a an***@example.com.',
    ).parentElement;
    expect(stack).toHaveClass('grid', 'gap-4');
    expect(stack).toContainElement(field);
    expect(stack).not.toContainElement(screen.getByRole('button', { name: 'Confirmar' }));
  });
});

describe('EndedStep', () => {
  it('WEB-30 WEB-18 con los intentos agotados indica que no se realizó y ofrece intentar de nuevo', async () => {
    const onRestart = vi.fn();
    const user = userEvent.setup();
    render(
      <EndedStep
        problem={problem('OTP_ATTEMPTS_EXHAUSTED')}
        transfer={null}
        accounts={[]}
        onRestart={onRestart}
      />,
    );

    // "La transferencia no se realizó" es ahora el título de FlowHeader (R37).
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('OTP_ATTEMPTS_EXHAUSTED'));
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(onRestart).toHaveBeenCalled();
  });

  it('WEB-18 con el código vencido pide iniciar la transferencia de nuevo', () => {
    render(
      <EndedStep
        problem={problem('TRANSFER_EXPIRED', { status: 409 })}
        transfer={null}
        accounts={[]}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(problemMessage('TRANSFER_EXPIRED'));
  });

  it('WEB-18 una revalidación fallida por límite diario indica el restante', () => {
    render(
      <EndedStep
        problem={problem('DAILY_LIMIT_EXCEEDED', { remaining: '1500.00' })}
        transfer={null}
        accounts={[]}
        onRestart={vi.fn()}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Superaste tu límite diario');
    expect(alert).toHaveTextContent('Hoy puedes enviar hasta $1,500.00');
  });

  it('WEB-18 WEB-25 al agotar los intentos muestra el comprobante con el estado "Fallida"', () => {
    render(
      <EndedStep
        problem={problem('OTP_ATTEMPTS_EXHAUSTED')}
        transfer={pendingOtpTransfer()}
        accounts={OVERVIEW.accounts}
        onRestart={vi.fn()}
      />,
    );
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Fallida')).toBeVisible();
    expect(receipt).toHaveTextContent('Principal · •••• 9719');
    expect(screen.getByRole('link', { name: 'Ver mis cuentas' })).toHaveAttribute('href', '/');
  });

  it('WEB-18 con TRANSFER_NOT_PENDING el comprobante muestra el estado que da la API', () => {
    render(
      <EndedStep
        problem={problem('TRANSFER_NOT_PENDING', { status: 409, transferStatus: 'REJECTED' })}
        transfer={pendingOtpTransfer()}
        accounts={OVERVIEW.accounts}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(problemMessage('TRANSFER_NOT_PENDING'));
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Rechazada')).toBeVisible();
  });
});
