import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { SideNav } from './SideNav';
import { TabBar, type NavItem } from './TabBar';

const WEB_ITEMS: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'movements', href: '/movements' },
  { key: 'transfer', href: '/transfers/new' },
  { key: 'beneficiaries', href: '/beneficiaries' },
];
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('TabBar', () => {
  it('WEB-27 muestra las cuatro pestañas y marca la actual', () => {
    render(<TabBar items={WEB_ITEMS} current="movements" position="static" />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByRole('link', { name: 'Movimientos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });
});

describe('SideNav', () => {
  it('WEB-26 marca el destino actual y cierra sesión', async () => {
    const onLogout = vi.fn();
    render(<SideNav items={WEB_ITEMS} current="beneficiaries" user={USER} onLogout={onLogout} />);
    expect(screen.getByRole('link', { name: 'Beneficiarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('WEB-23 los enlaces y el botón de cierre sobre el fondo oscuro usan anillo de foco lima', () => {
    render(<SideNav items={WEB_ITEMS} current="home" user={USER} onLogout={() => {}} />);
    expect(screen.getByRole('link', { name: 'Movimientos' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
  });
});

describe('AppHeader', () => {
  it('WEB-27 saluda con el nombre y el avatar abre el menú de la cuenta', async () => {
    const onLogout = vi.fn();
    render(<AppHeader user={USER} onLogout={onLogout} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('WEB-27 en otras pestañas muestra el título de la página', () => {
    render(<AppHeader user={USER} title="Movimientos" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeInTheDocument();
  });
});
