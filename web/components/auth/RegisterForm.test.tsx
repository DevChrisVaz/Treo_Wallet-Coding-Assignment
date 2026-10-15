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
  password: 'contraseña-larga-1',
  firstNames: 'Ana',
  paternalSurname: 'Gómez',
  maternalSurname: 'Castillo',
  birthDate: '1990-01-01',
  birthState: 'DF',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

async function fill(values: Partial<typeof VALID> & { confirmPassword?: string } = {}) {
  const data = { ...VALID, confirmPassword: VALID.password, ...values };
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), data.email);
  await user.type(screen.getByLabelText('Contraseña'), data.password);
  await user.type(screen.getByLabelText('Confirmar contraseña'), data.confirmPassword);
  await user.type(screen.getByLabelText('Nombre(s)'), data.firstNames);
  await user.type(screen.getByLabelText('Apellido paterno'), data.paternalSurname);
  if (data.maternalSurname) {
    await user.type(screen.getByLabelText('Apellido materno (opcional)'), data.maternalSurname);
  }
  await user.type(screen.getByLabelText('Fecha de nacimiento'), data.birthDate);
  await user.selectOptions(screen.getByLabelText('Entidad de nacimiento'), data.birthState);
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

  it('WEB-11 el correo se envía recortado y en minúsculas', async () => {
    registerMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    render(<RegisterForm />);

    await fill({ email: 'Ana@Example.COM' });

    expect(registerMock).toHaveBeenCalledWith(VALID);
  });

  it('WEB-11 la confirmación de la contraseña no se envía y, si no coincide, marca el campo al salir', async () => {
    render(<RegisterForm />);

    await fill({ confirmPassword: 'otra-contraseña-1' });

    const confirm = screen.getByLabelText('Confirmar contraseña');
    expect(confirm).toHaveAttribute('aria-invalid', 'true');
    expect(confirm).toHaveAccessibleDescription(
      expect.stringContaining('Las contraseñas no coinciden'),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('WEB-11 valida al salir de cada campo, sin esperar al envío', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Nombre(s)'), 'Ana3');
    expect(screen.getByLabelText('Nombre(s)')).not.toHaveAttribute('aria-invalid', 'true');
    await user.tab();
    expect(screen.getByLabelText('Nombre(s)')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Teléfono'), '1555123456');
    await user.tab();
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true');
  });

  it('WEB-11 el apellido materno es opcional y no se envía si está vacío', async () => {
    registerMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
    render(<RegisterForm />);

    await fill({ maternalSurname: '' });

    const expected: Record<string, unknown> = { ...VALID };
    delete expected.maternalSurname;
    expect(registerMock).toHaveBeenCalledWith(expected);
  });

  it('WEB-11 la entidad se elige por nombre y se envía como código', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const select = screen.getByLabelText('Entidad de nacimiento');

    await user.selectOptions(select, 'Ciudad de México');

    expect(select).toHaveValue('DF');
  });

  it('WEB-11 marca la fecha y la entidad que no coinciden con la CURP al salir del campo', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('CURP'), VALID.curp);
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1990-01-02');
    await user.selectOptions(screen.getByLabelText('Entidad de nacimiento'), 'Jalisco');
    await user.tab();

    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAccessibleDescription(
      expect.stringContaining('La fecha no coincide con tu CURP'),
    );
    expect(screen.getByLabelText('Entidad de nacimiento')).toHaveAccessibleDescription(
      expect.stringContaining('La entidad no coincide con tu CURP'),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('WEB-11 no rellena la fecha ni la entidad a partir de la CURP', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('CURP'), VALID.curp);

    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('');
    expect(screen.getByLabelText('Entidad de nacimiento')).toHaveValue('');
  });

  it('WEB-11 un RFC que no coincide con la CURP marca el RFC', async () => {
    render(<RegisterForm />);

    await fill({ rfc: 'GOMA850101AB1' });

    expect(screen.getByLabelText('RFC')).toHaveAccessibleDescription(
      expect.stringContaining('El RFC no coincide con tu CURP'),
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('WEB-11 CURP, RFC y teléfono se restringen mientras se escriben, también al pegar', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const curp = screen.getByLabelText('CURP');
    const rfc = screen.getByLabelText('RFC');
    const phone = screen.getByLabelText('Teléfono');
    expect(curp).toHaveAttribute('maxlength', '18');
    expect(rfc).toHaveAttribute('maxlength', '13');
    expect(phone).toHaveAttribute('maxlength', '10');

    await user.type(curp, 'gomc-9001 01hdfnlr09zz');
    expect(curp).toHaveValue('GOMC900101HDFNLR09');
    await user.type(rfc, 'gomc900101ab1');
    expect(rfc).toHaveValue('GOMC900101AB1');
    await user.click(phone);
    await user.paste('55-1234 5678 99');
    expect(phone).toHaveValue('5512345678');
  });

  it.each([
    ['/curp', 'DATE_OUT_OF_RANGE', 'curp', 'CURP'],
    ['/curp', 'INVALID_DATE', 'curp', 'CURP'],
    ['/rfc', 'INVALID_FORMAT', 'rfc', 'RFC'],
  ] as const)(
    'WEB-11 un error del servidor en %s (%s) se muestra en su campo',
    async (pointer, code, _field, label) => {
      registerMock.mockResolvedValue({
        ok: false,
        problem: problem('VALIDATION_FAILED', {
          errors: [{ pointer, code, message: 'Mensaje de la API' }],
        }),
      });
      render(<RegisterForm />);

      await fill();

      expect(await screen.findByText('Mensaje de la API')).toBeVisible();
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    },
  );

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

  it('WEB-31 WEB-25 el botón ocupa todo el ancho y la invitación al inicio de sesión va fuera del formulario', () => {
    const { container } = render(<RegisterForm />);
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toHaveClass('w-full');
    const invitation = screen.getByRole('link', { name: 'Inicia sesión' });
    expect(container.querySelector('form')?.contains(invitation)).toBe(false);
    expect(invitation).toHaveClass('min-h-11');
  });
});
