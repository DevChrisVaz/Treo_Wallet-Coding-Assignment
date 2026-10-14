import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movement } from '@/test/fixtures';
import { BalanceHero } from './BalanceHero';
import { IconButton } from './Icon';
import { MovementList } from './MovementList';
import { QuickActions } from './QuickActions';
import { RouterLinkProvider, type RouterLinkProps } from './RouterLink';

describe('BalanceHero', () => {
  it('WEB-28 muestra el total completo para lectores de pantalla y el disponible de hoy', () => {
    render(<BalanceHero total="35000.00" available="31500.00" />);
    const hero = screen.getByRole('region', { name: 'Saldo total' });
    expect(hero).toHaveTextContent('$35,000.00');
    expect(hero).toHaveTextContent('Disponible hoy $31,500.00');
  });

  it('DSG-13 un saldo muy grande baja de tamaño para caber en una línea', () => {
    render(<BalanceHero total="1234567890.00" available="0.00" />);
    const amount = screen.getByTestId('hero-amount');
    expect(amount).toHaveClass('text-h1');
    expect(amount).not.toHaveClass('text-display-xl');
  });

  it('WEB-28 DSG-13 con el texto agrandado el monto pasa de línea en lugar de cortarse', () => {
    render(<BalanceHero total="35000.00" available="31500.00" />);
    const amount = screen.getByTestId('hero-amount');
    expect(amount).not.toHaveClass('whitespace-nowrap');
    expect(amount).toHaveClass('[overflow-wrap:anywhere]');
  });
});

describe('QuickActions', () => {
  it('WEB-28 cada acción tiene texto visible', () => {
    render(
      <QuickActions
        actions={[{ key: 't', label: 'Transferir', icon: 'transfer', href: '/transfers/new' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Transferir' })).toHaveAttribute(
      'href',
      '/transfers/new',
    );
  });

  it('WEB-23 cada acción sobre el hero muestra un anillo de foco lima', () => {
    render(
      <QuickActions
        actions={[
          { key: 't', label: 'Transferir', icon: 'transfer', href: '/transfers/new' },
          { key: 'm', label: 'Movimientos', icon: 'movements', onClick: () => {} },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Transferir' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
    expect(screen.getByRole('button', { name: 'Movimientos' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
  });
});

describe('MovementList', () => {
  it('WEB-29 agrupa por día de Ciudad de México', () => {
    const now = new Date('2026-10-13T18:00:00Z');
    render(
      <MovementList
        now={now}
        movements={[
          movement({ id: 'a', occurredAt: '2026-10-13T16:42:00Z' }),
          movement({ id: 'b', occurredAt: '2026-10-13T05:30:00Z' }),
          movement({ id: 'c', occurredAt: '2026-10-09T18:20:00Z' }),
        ]}
      />,
    );
    const day = (name: string) =>
      screen.getByRole('heading', { name }).nextElementSibling as HTMLElement;
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Hoy', 'Ayer', '9 oct']);
    expect(within(day('Ayer')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('WEB-29 las filas del día muestran solo la hora y no llevan borde: la lista pone los divisores', () => {
    render(
      <MovementList
        now={new Date('2026-10-13T18:00:00Z')}
        movements={[movement({ id: 'a', occurredAt: '2026-10-13T16:42:00Z' })]}
      />,
    );
    const day = (name: string) =>
      screen.getByRole('heading', { name }).nextElementSibling as HTMLElement;
    const row = within(day('Hoy')).getByRole('listitem');
    expect(within(row).getByText('10:42').tagName).toBe('TIME');
    expect(within(row).getByText('13 oct 2026,', { exact: false })).toHaveClass('sr-only');
    expect(row).not.toHaveClass('border-b');
    expect(row.parentElement).toHaveClass('divide-y', 'divide-border');
  });

  it('WEB-23 WEB-29 los días no son regiones y su nivel de encabezado se elige', () => {
    render(
      <MovementList
        movements={[movement()]}
        now={new Date('2026-10-13T18:00:00Z')}
        headingLevel={2}
      />,
    );
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });
});

function AppLink({ children, ...props }: RouterLinkProps) {
  return (
    <a data-app-link="" {...props}>
      {children}
    </a>
  );
}

describe('enlaces internos del kit', () => {
  it('WEB-24 las acciones rápidas y el botón de icono con destino usan el enlace de la app', () => {
    render(
      <RouterLinkProvider value={AppLink}>
        <QuickActions
          actions={[{ key: 't', label: 'Transferir', icon: 'transfer', href: '/transfers/new' }]}
        />
        <IconButton icon="close" label="Salir de la transferencia" href="/" />
      </RouterLinkProvider>,
    );
    expect(screen.getByRole('link', { name: 'Transferir' })).toHaveAttribute('data-app-link');
    expect(screen.getByRole('link', { name: 'Salir de la transferencia' })).toHaveAttribute(
      'data-app-link',
    );
  });
});
