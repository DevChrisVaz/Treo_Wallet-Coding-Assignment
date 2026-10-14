import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { logout } from '@/app/actions/auth';
import { OVERVIEW } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { queryKeys } from '@/lib/client/query-keys';
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
    renderWithClient(<LogoutButton />);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('WEB-05 borra del navegador los datos en caché de la sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    const { client } = renderWithClient(<LogoutButton />);
    client.setQueryData(queryKeys.accounts, OVERVIEW);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(client.getQueryData(queryKeys.accounts)).toBeUndefined();
  });

  it('WEB-05 aunque la acción falle, lleva al inicio de sesión', async () => {
    logoutMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderWithClient(<LogoutButton />);

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

  it('WEB-34 ofrece "Programadas", que lleva a /transfers/scheduled', () => {
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
  });

  it('WEB-34 WEB-23 en la página de programadas marca "Programadas" y no "Transferir"', () => {
    setLocation('/transfers/scheduled');
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Programadas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Transferir' })).not.toHaveAttribute('aria-current');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderWithClient(
      <>
        <AppNav />
        <LogoutButton />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
