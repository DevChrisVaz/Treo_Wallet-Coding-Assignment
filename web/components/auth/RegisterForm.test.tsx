import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { register } from '@/app/actions/auth';
import { problem } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { RegisterForm } from './RegisterForm';

vi.mock('@/app/actions/auth', () => ({ register: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const registerMock = vi.mocked(register);

const VALID = {
  email: 'ana@example.com',
  password: 'una contraseña larga',
  fullName: 'Ana Gómez Castillo',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

async function fill(values: Partial<typeof VALID> = {}) {
  const data = { ...VALID, ...values };
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), data.email);
  await user.type(screen.getByLabelText('Contraseña'), data.password);
  await user.type(screen.getByLabelText('Nombre completo'), data.fullName);
  await user.type(screen.getByLabelText('CURP'), data.curp);
  await user.type(screen.getByLabelText('RFC'), data.rfc);
  await user.type(screen.getByLabelText('Teléfono'), data.phone);
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

beforeEach(() => {
  registerMock.mockReset();
  setLocation('/register');
});

describe('RegisterForm', () => {
  it('WEB-11 envía un registro válido y pasa a la verificación con el mensaje genérico', async () => {
    registerMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    render(<RegisterForm />);

    await fill();

    expect(registerMock).toHaveBeenCalledWith(VALID);
    expect(router.push).toHaveBeenCalledWith('/verify-email?email=ana%40example.com&registered=1');
  });

  it('WEB-11 una CURP con dígito verificador inválido marca el campo y no envía', async () => {
    render(<RegisterForm />);

    await fill({ curp: 'GOMC900101HDFNLR08' });

    const curp = screen.getByLabelText('CURP');
    expect(curp).toHaveAttribute('aria-invalid', 'true');
    expect(curp).toHaveAccessibleDescription(
      expect.stringContaining('El dígito verificador de la CURP no es válido'),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('WEB-11 convierte la CURP y el RFC a mayúsculas mientras se escriben', async () => {
    registerMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    render(<RegisterForm />);

    await fill({ curp: 'gomc900101hdfnlr09', rfc: 'gomc900101ab1' });

    expect(registerMock).toHaveBeenCalledWith(VALID);
  });

  it('WEB-07 muestra en su campo los errores de validación que devuelva el servidor', async () => {
    registerMock.mockResolvedValue({
      ok: false,
      problem: problem('VALIDATION_FAILED', {
        errors: [{ pointer: '/phone', code: 'INVALID_FORMAT', message: 'Teléfono inválido' }],
      }),
    });
    render(<RegisterForm />);

    await fill();

    expect(await screen.findByText('Teléfono inválido')).toBeVisible();
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('WEB-19 un rechazo sin campos se anuncia como alerta', async () => {
    registerMock.mockResolvedValue({
      ok: false,
      problem: problem('RATE_LIMITED', { status: 429, retryAfter: 120 }),
    });
    render(<RegisterForm />);

    await fill();

    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo en 2 minutos');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<RegisterForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
