import { iconConcepts, iconNames } from '@devchrisvaz/wallet-design-tokens';
import * as Lucide from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, initials } from './Avatar';
import { ICONS, Icon, IconButton } from './Icon';

describe('Icon', () => {
  it.each(iconConcepts)('DSG-15 %s usa el icono del mapa compartido', (concept) => {
    expect(ICONS[concept]).toBe((Lucide as unknown as Record<string, unknown>)[iconNames[concept]]);
  });

  it('DSG-15 un icono decorativo se oculta a los lectores de pantalla', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('DSG-15 un icono con etiqueta se anuncia como imagen', () => {
    render(<Icon name="error" label="Error" />);
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
  });

  it('DSG-15 un botón solo con icono tiene nombre accesible', () => {
    render(<IconButton icon="close" label="Cerrar" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Cerrar' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('WEB-23 el botón sobre superficie oscura usa anillo de foco lima', () => {
    render(<IconButton icon="close" label="Cerrar" tone="onDark" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
  });

  it('WEB-23 el botón de superficie clara conserva el anillo de sistema', () => {
    render(<IconButton icon="close" label="Cerrar" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).not.toHaveClass(
      'focus-visible:outline-accent-on-dark',
    );
  });
});

describe('Avatar', () => {
  it.each([
    ['Ana Gómez Castillo', 'AG'],
    ['Ángel', 'Á'],
    ['  luis   pérez ', 'LP'],
  ])('DSG-17 las iniciales de "%s" son %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('DSG-17 el avatar es decorativo', () => {
    const { container } = render(<Avatar initials="AG" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
