import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { logout } from '@/app/actions/auth';
import { queryKeys } from '@/lib/client/query-keys';
import { OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { AppFrame } from './AppFrame';

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));
// Marca los enlaces de next/link para distinguirlos de un <a> que recargaría la página.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

const logoutMock = vi.mocked(logout);
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

function renderFrame(path: string) {
  setLocation(path);
  return renderWithClient(
    <AppFrame user={USER}>
      <p>Contenido</p>
    </AppFrame>,
  );
}

function sideNav(): HTMLElement {
  const aside = screen.getAllByRole('navigation', { name: 'Principal' })[0]?.closest('aside');
  if (!aside) throw new Error('Sin navegación lateral');
  return aside;
}

beforeEach(() => {
  logoutMock.mockReset();
});

describe('AppFrame', () => {
  it('WEB-26 WEB-27 en Movimientos marca el destino actual en la navegación lateral y en las pestañas', () => {
    renderFrame(`/accounts/${PRINCIPAL.id}/movements`);
    const [side, tabs] = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(within(side!).getByRole('link', { name: 'Movimientos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs!).getAllByRole('link')).toHaveLength(4);
    const tab = within(tabs!).getByRole('link', { name: 'Movimientos' });
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tab).toHaveAttribute('href', '/movements');
    expect(within(tabs!).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('WEB-24 los destinos y la acción principal navegan con next/link, sin recargar la página', () => {
    renderFrame('/');
    for (const link of screen.getAllByRole('link', { name: 'Beneficiarios' })) {
      expect(link).toHaveAttribute('data-next-link');
    }
    const primary = screen.getByRole('link', { name: 'Nueva transferencia' });
    expect(primary).toHaveAttribute('href', '/transfers/new');
    expect(primary).toHaveAttribute('data-next-link');
  });

  it('WEB-26 en Beneficiarios la acción principal es "Agregar beneficiario"', () => {
    renderFrame('/beneficiaries');
    expect(screen.getByRole('link', { name: 'Agregar beneficiario' })).toHaveAttribute(
      'href',
      '/beneficiaries/new',
    );
  });

  it('WEB-27 en el flujo de transferencia no hay pestañas ni menú de la cuenta', () => {
    renderFrame('/transfers/new');
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Menú de la cuenta' })).not.toBeInTheDocument();
  });

  it('WEB-23 en Inicio el saludo es el h1 de la forma de app y "Inicio" el del dashboard', () => {
    renderFrame('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
  });

  it('WEB-26 WEB-05 "Cerrar sesión" de la navegación lateral cierra la sesión, borra la caché y lleva al inicio de sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    const { client } = renderFrame('/');
    client.setQueryData(queryKeys.accounts, OVERVIEW);

    await user.click(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(client.getQueryData(queryKeys.accounts)).toBeUndefined();
  });

  it('WEB-27 WEB-05 el menú del avatar cierra la sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    renderFrame('/');

    await user.click(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' });
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('WEB-05 aunque la acción falle, lleva al inicio de sesión', async () => {
    logoutMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderFrame('/');
    await user.click(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('WEB-05 un doble clic en "Cerrar sesión" cierra la sesión una sola vez', async () => {
    logoutMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderFrame('/');
    await user.dblClick(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('WEB-05 mientras se cierra la sesión, los dos botones muestran "Cerrando…", ocupados y deshabilitados', async () => {
    logoutMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderFrame('/');

    await user.click(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' });
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));

    for (const region of [sideNav(), sheet]) {
      const button = within(region).getByRole('button', { name: 'Cerrando…' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(
        within(region).queryByRole('button', { name: 'Cerrar sesión' }),
      ).not.toBeInTheDocument();
    }
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('WEB-23 la estructura de la app no tiene problemas de accesibilidad', async () => {
    const { container } = renderFrame('/');
    // jsdom no aplica `display: none`: las dos navegaciones y los dos encabezados están a la vez en el DOM
    // (lo cubre e2e/a11y.spec.ts en la tarea 6.7).
    expect(
      await axe(container, {
        rules: {
          'landmark-unique': { enabled: false },
          'landmark-no-duplicate-banner': { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });
});
