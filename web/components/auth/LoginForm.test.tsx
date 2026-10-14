import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { login } from '@/app/actions/auth';
import { USER, problem } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { LoginForm } from './LoginForm';

vi.mock('@/app/actions/auth', () => ({ login: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const loginMock = vi.mocked(login);

async function fillAndSubmit(email = 'ana@example.com', password = 'una contraseña larga') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  return user;
}

beforeEach(() => {
  loginMock.mockReset();
  setLocation('/login');
});

describe('LoginForm', () => {
  it('WEB-12 inicia sesión con correo y contraseña y lleva al destino', async () => {
    loginMock.mockResolvedValue({ ok: true, data: { user: USER } });
    render(<LoginForm redirectTo="/beneficiaries" />);

    await fillAndSubmit();

    expect(loginMock).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'una contraseña larga',
    });
    expect(router.replace).toHaveBeenCalledWith('/beneficiaries');
  });

  it('WEB-12 ante INVALID_CREDENTIALS muestra un único mensaje genérico sin marcar un campo', async () => {
    loginMock.mockResolvedValue({
      ok: false,
      problem: problem('INVALID_CREDENTIALS', { status: 401 }),
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      problemMessage('INVALID_CREDENTIALS'),
    );
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Contraseña')).not.toHaveAttribute('aria-invalid');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('WEB-12 ante EMAIL_NOT_VERIFIED lleva a la verificación con el correo precargado', async () => {
    loginMock.mockResolvedValue({
      ok: false,
      problem: problem('EMAIL_NOT_VERIFIED', { status: 403 }),
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(router.push).toHaveBeenCalledWith('/verify-email?email=ana%40example.com');
  });

  it('WEB-12 ante RATE_LIMITED con Retry-After 300 indica esperar 5 minutos', async () => {
    loginMock.mockResolvedValue({
      ok: false,
      problem: problem('RATE_LIMITED', { status: 429, retryAfter: 300 }),
    });
    render(<LoginForm />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo en 5 minutos');
  });

  it('WEB-07 valida el correo en el formulario con el contrato y no envía si es inválido', async () => {
    render(<LoginForm />);

    await fillAndSubmit('no-es-correo');

    expect(await screen.findByText('El correo no tiene un formato válido')).toBeVisible();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('WEB-12 deshabilita el botón mientras se envía', async () => {
    loginMock.mockReturnValue(new Promise(() => undefined));
    render(<LoginForm />);

    await fillAndSubmit();

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
  });

  it('WEB-03 con la sesión expirada muestra "Tu sesión expiró"', () => {
    render(<LoginForm notice="expired" />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró');
  });

  it('WEB-08 si la acción no responde, muestra un error con opción de reintentar', async () => {
    loginMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LoginForm />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<LoginForm notice="expired" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
