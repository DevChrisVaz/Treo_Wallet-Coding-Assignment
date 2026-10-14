import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { resendVerification, verifyEmail } from '@/app/actions/auth';
import { USER, problem } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { REGISTERED_MESSAGE, VerifyEmailForm } from './VerifyEmailForm';

vi.mock('@/app/actions/auth', () => ({ verifyEmail: vi.fn(), resendVerification: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const verifyMock = vi.mocked(verifyEmail);
const resendMock = vi.mocked(resendVerification);

beforeEach(() => {
  verifyMock.mockReset();
  resendMock.mockReset();
  setLocation('/verify-email');
});

async function submitCode(code: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Código de 6 dígitos'), code);
  await user.click(screen.getByRole('button', { name: 'Verificar correo' }));
  return user;
}

describe('VerifyEmailForm', () => {
  it('WEB-11 tras el registro muestra siempre el mismo mensaje genérico', () => {
    render(<VerifyEmailForm email="ana@example.com" registered />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Si los datos son correctos, recibirás un correo con las instrucciones',
    );
  });

  it('WEB-11 con el código correcto inicia la sesión y muestra el resumen de cuentas', async () => {
    verifyMock.mockResolvedValue({ ok: true, data: { user: USER } });
    render(<VerifyEmailForm email="ana@example.com" />);

    expect(screen.getByLabelText('Correo')).toHaveValue('ana@example.com');
    await submitCode('123456');

    expect(verifyMock).toHaveBeenCalledWith({ email: 'ana@example.com', code: '123456' });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('WEB-11 un código incorrecto muestra los intentos restantes', async () => {
    verifyMock.mockResolvedValue({
      ok: false,
      problem: problem('VERIFICATION_CODE_INVALID', { attemptsRemaining: 2 }),
    });
    render(<VerifyEmailForm email="ana@example.com" />);

    await submitCode('000000');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('VERIFICATION_CODE_INVALID'));
    expect(alert).toHaveTextContent('Te quedan 2 intentos');
  });

  it('WEB-07 un código que no tiene 6 dígitos marca el campo y no se envía', async () => {
    render(<VerifyEmailForm email="ana@example.com" />);
    await submitCode('12345');
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveAttribute('aria-invalid', 'true');
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('WEB-11 permite pedir el reenvío del código', async () => {
    resendMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    const user = userEvent.setup();
    render(<VerifyEmailForm email="ana@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(resendMock).toHaveBeenCalledWith({ email: 'ana@example.com' });
    expect(await screen.findByRole('status')).toHaveTextContent('te enviamos un código nuevo');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<VerifyEmailForm email="ana@example.com" registered />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WEB-31 WEB-25 tras el registro el aviso usa el tono de éxito y las acciones van apiladas', () => {
    render(<VerifyEmailForm email="ana@example.com" registered />);
    expect(screen.getByText(REGISTERED_MESSAGE).closest('.bg-success-soft')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Verificar correo' }).parentElement).toHaveClass(
      'grid',
      'gap-3',
    );
  });
});
