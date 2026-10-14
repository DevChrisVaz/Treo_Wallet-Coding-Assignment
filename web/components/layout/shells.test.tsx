import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { BrandShell } from './BrandShell';

const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('AppShell', () => {
  it('WEB-24 tiene navegación lateral (dashboard) y pestañas (app)', () => {
    render(
      <AppShell current="home" title="Inicio" user={USER}>
        <p>Contenido</p>
      </AppShell>,
    );
    const navs = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(navs).toHaveLength(2);
    expect(navs[0]?.closest('aside')).toHaveClass('hidden', 'dashboard:flex');
    expect(navs[1]).toHaveClass('dashboard:hidden');
  });

  it('WEB-27 el contenido reserva el alto de la barra de pestañas', () => {
    render(
      <AppShell current="home" title="Inicio" user={USER}>
        <p>Contenido</p>
      </AppShell>,
    );
    expect(screen.getByRole('main')).toHaveClass(
      'pb-[calc(var(--dt-layout-tab-bar-height)+env(safe-area-inset-bottom)+1.5rem)]',
    );
  });

  it('WEB-25 con pestañas el contenido empieza 20 px bajo el encabezado en teléfono, como Screen en móvil', () => {
    render(
      <AppShell current="home" title="Inicio" user={USER}>
        <p>Contenido</p>
      </AppShell>,
    );
    expect(screen.getByRole('main')).toHaveClass('pt-5', 'dashboard:pt-0');
  });

  it('WEB-25 en el flujo el contenido no suma margen superior: lo da FlowHeader', () => {
    render(
      <AppShell current="transfer" title="Transferir" user={USER} mode="flow">
        <p>Paso</p>
      </AppShell>,
    );
    expect(screen.getByRole('main')).not.toHaveClass('pt-5');
  });

  it('WEB-27 en el flujo de transferencia no hay barra de pestañas', () => {
    render(
      <AppShell current="transfer" title="Transferir" user={USER} mode="flow">
        <p>Paso</p>
      </AppShell>,
    );
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1);
  });
});

describe('AppShell encabezados', () => {
  it('WEB-23 en la forma de app el saludo de Inicio es el único h1 visible', () => {
    render(
      <AppShell current="home" title="Inicio" user={USER}>
        <p>Contenido</p>
      </AppShell>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
  });

  it('WEB-27 en el flujo no hay encabezado de la app ni TopBar con h1', () => {
    render(
      <AppShell current="transfer" title="Transferir" user={USER} mode="flow">
        <p>Paso</p>
      </AppShell>,
    );
    expect(screen.queryByRole('heading', { name: 'Transferir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menú de la cuenta' })).not.toBeInTheDocument();
  });
});

describe('BrandShell', () => {
  it('WEB-31 muestra el Wordmark sobre la superficie de marca y el contenido en una hoja', () => {
    render(
      <BrandShell title="Inicia sesión">
        <form aria-label="Inicio de sesión" />
      </BrandShell>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Inicio de sesión' })).toBeInTheDocument();
  });
});
