import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { RouterLink, RouterLinkProvider, type RouterLinkProps } from './RouterLink';
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

  it('WEB-27 WEB-28 fija abajo, publica su alto real para que el contenido lo reserve aunque crezca con el texto agrandado', () => {
    let measure: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          measure = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const root = document.documentElement;
    const { unmount } = render(<TabBar items={WEB_ITEMS} current="home" />);
    const list = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('list');
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 136));
    measure();
    expect(root.style.getPropertyValue('--tab-bar-height')).toBe('136px');
    unmount();
    expect(root.style.getPropertyValue('--tab-bar-height')).toBe('');
  });

  it('WEB-27 dentro de un lienzo (posición estática) no reserva alto en la página', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<TabBar items={WEB_ITEMS} current="home" position="static" />);
    expect(document.documentElement.style.getPropertyValue('--tab-bar-height')).toBe('');
  });
});

describe('destinos solo laterales', () => {
  const WITH_SCHEDULED: NavItem[] = [
    ...WEB_ITEMS.slice(0, 3),
    { key: 'scheduled', href: '/transfers/scheduled', sideOnly: true },
    ...WEB_ITEMS.slice(3),
  ];

  it('WEB-34 WEB-27 la barra de pestañas omite "Programadas" y conserva sus cuatro pestañas', () => {
    render(<TabBar items={WITH_SCHEDULED} current="scheduled" position="static" />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).queryByRole('link', { name: 'Programadas' })).not.toBeInTheDocument();
  });

  it('WEB-34 WEB-26 la navegación lateral muestra "Programadas" con su propio icono y la marca', () => {
    render(<SideNav items={WITH_SCHEDULED} current="scheduled" user={USER} />);
    const link = screen.getByRole('link', { name: 'Programadas' });
    expect(link).toHaveAttribute('href', '/transfers/scheduled');
    expect(link).toHaveAttribute('aria-current', 'page');
    // CalendarClock (concepto `scheduled`, R58), no el Send de "Transferir".
    expect(link.querySelector('svg')).toHaveClass('lucide-calendar-clock');
    expect(link.querySelector('svg')).not.toHaveClass('lucide-send');
  });
});

describe('SideNav', () => {
  it('WEB-26 marca el destino actual', () => {
    render(<SideNav items={WEB_ITEMS} current="beneficiaries" user={USER} />);
    expect(screen.getByRole('link', { name: 'Beneficiarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('WEB-26 el perfil es un solo botón con menú que no muestra "Cerrar sesión" hasta abrirlo', async () => {
    const onLogout = vi.fn();
    render(<SideNav items={WEB_ITEMS} current="home" user={USER} onLogout={onLogout} />);
    const profile = screen.getByRole('button', { name: /Ana Gómez Castillo/ });
    expect(profile).toHaveAttribute('aria-haspopup', 'menu');
    expect(profile).toHaveAttribute('aria-expanded', 'false');
    expect(profile).toHaveTextContent('ana@example.com');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    await userEvent.click(profile);
    expect(profile).toHaveAttribute('aria-expanded', 'true');
    const item = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
    expect(item).toHaveFocus();
    await userEvent.click(item);
    expect(onLogout).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(profile).toHaveFocus();
  });

  it('WEB-26 nombre y correo se truncan con puntos suspensivos sin desbordar el botón', () => {
    render(
      <SideNav
        items={WEB_ITEMS}
        current="home"
        user={{ name: 'N'.repeat(120), email: 'e'.repeat(120) + '@example.com' }}
      />,
    );
    const profile = screen.getByRole('button', { name: /N{120}/ });
    expect(profile).toHaveClass('w-full');
    const lines = profile.querySelectorAll('.truncate');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.parentElement).toHaveClass('min-w-0');
  });

  it('WEB-26 Escape, un clic fuera y las flechas gestionan el menú', async () => {
    render(<SideNav items={WEB_ITEMS} current="home" user={USER} onLogout={() => {}} />);
    const profile = screen.getByRole('button', { name: /Ana Gómez Castillo/ });
    await userEvent.click(profile);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(profile).toHaveFocus();
    await userEvent.click(profile);
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('WEB-26 con "Cerrando…" la opción queda ocupada y deshabilitada', async () => {
    render(
      <SideNav
        items={WEB_ITEMS}
        current="home"
        user={USER}
        onLogout={() => {}}
        loggingOut
        defaultMenuOpen
      />,
    );
    const item = screen.getByRole('menuitem', { name: 'Cerrando…' });
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute('aria-busy', 'true');
  });

  it('WEB-23 los enlaces sobre el fondo oscuro y el botón del perfil usan anillo de foco lima', () => {
    render(<SideNav items={WEB_ITEMS} current="home" user={USER} onLogout={() => {}} />);
    expect(screen.getByRole('link', { name: 'Movimientos' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
    expect(screen.getByRole('button', { name: /Ana Gómez Castillo/ })).toHaveClass(
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

  it('WEB-27 el botón del menú de la cuenta tiene un área de 44 px', () => {
    render(<AppHeader user={USER} />);
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toHaveClass('size-11');
  });

  it('WEB-23 el botón del avatar no tiene más texto que su etiqueta: las iniciales las dibuja CSS', () => {
    render(<AppHeader user={USER} />);
    const button = screen.getByRole('button', { name: 'Menú de la cuenta' });
    // Su nombre contiene todo su texto visible (WCAG 2.5.3, axe `label-content-name-mismatch`).
    expect(button).toHaveTextContent(/^$/);
    expect(button.querySelector('[data-initials]')).toHaveAttribute('data-initials', 'AG');
  });

  it('WEB-27 en otras pestañas muestra el título de la página', () => {
    render(<AppHeader user={USER} title="Movimientos" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeInTheDocument();
  });
});

function AppLink({ children, ...props }: RouterLinkProps) {
  return (
    <a data-app-link="" {...props}>
      {children}
    </a>
  );
}

describe('RouterLink', () => {
  it('WEB-24 con el proveedor de la app, pestañas y navegación lateral usan su enlace', () => {
    render(
      <RouterLinkProvider value={AppLink}>
        <TabBar items={WEB_ITEMS} current="home" position="static" />
        <SideNav items={WEB_ITEMS} current="home" user={USER} />
      </RouterLinkProvider>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(8);
    for (const link of links) expect(link).toHaveAttribute('data-app-link');
  });

  it('WEB-24 sin proveedor (lienzos de design-sync) son enlaces <a> normales', () => {
    render(<TabBar items={WEB_ITEMS} current="home" position="static" />);
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('data-app-link');
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
  });

  it.each([
    'https://treo.mx',
    '//treo.mx',
    'mailto:ayuda@treo.mx',
    'tel:+525555555555',
    '#contenido',
  ])(
    'WEB-24 con el proveedor, el destino externo %s es un <a> normal y el interno usa el enlace de la app',
    (href) => {
      render(
        <RouterLinkProvider value={AppLink}>
          <RouterLink href="/beneficiaries">Beneficiarios</RouterLink>
          <RouterLink href={href}>Externo</RouterLink>
        </RouterLinkProvider>,
      );
      expect(screen.getByRole('link', { name: 'Beneficiarios' })).toHaveAttribute('data-app-link');
      const external = screen.getByRole('link', { name: 'Externo' });
      expect(external).not.toHaveAttribute('data-app-link');
      expect(external).toHaveAttribute('href', href);
    },
  );
});
