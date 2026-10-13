import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { logout } from '@/app/actions/auth';
import { router, setLocation } from '@/test/support/next-navigation';
import { AppNav, LogoutButton } from './AppHeader';

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const logoutMock = vi.mocked(logout);

beforeEach(() => {
  logoutMock.mockReset();
  setLocation('/beneficiaries');
});

describe('LogoutButton', () => {
  it('WEB-05 cierra la sesión y muestra la pantalla de inicio de sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('WEB-05 aunque la acción falle, lleva al inicio de sesión', async () => {
    logoutMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

describe('AppNav', () => {
  it('WEB-23 marca la sección actual con aria-current', () => {
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Beneficiarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Cuentas' })).not.toHaveAttribute('aria-current');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(
      <>
        <AppNav />
        <LogoutButton />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
