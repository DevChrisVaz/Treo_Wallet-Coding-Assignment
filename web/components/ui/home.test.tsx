import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movement } from '@/test/fixtures';
import { BalanceHero } from './BalanceHero';
import { MovementList } from './MovementList';
import { QuickActions } from './QuickActions';

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
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Hoy', 'Ayer', '9 oct']);
    expect(
      within(screen.getByRole('region', { name: 'Ayer' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });
});
