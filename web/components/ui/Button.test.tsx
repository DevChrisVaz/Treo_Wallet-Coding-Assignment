import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('DSG-02 el principal usa la acción en reposo y el lima en hover, en píldora y de 48 px', () => {
    render(<Button>Enviar</Button>);
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveClass('bg-action', 'text-fg-on-action', 'rounded-pill', 'min-h-12');
    expect(button).toHaveClass('enabled:hover:bg-action-active');
    expect(button).toHaveClass('enabled:hover:text-fg-on-action-active');
    expect(button).toHaveAttribute('type', 'button');
  });

  it.each([
    ['secondary', 'border-action'],
    ['ghost', 'bg-transparent'],
    ['destructive', 'text-danger'],
  ] as const)('DSG-11 la variante %s usa sus tokens', (variant, token) => {
    render(<Button variant={variant}>Acción</Button>);
    expect(screen.getByRole('button', { name: 'Acción' })).toHaveClass(token);
  });

  it('DSG-11 WEB-17 enviando: se deshabilita, anuncia que está ocupado y muestra el texto de envío', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading loadingLabel="Enviando…" onClick={onClick}>
        Enviar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enviando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('DSG-11 conserva el tamaño al enviar: el texto original sigue ocupando su lugar, oculto', () => {
    render(
      <Button loading loadingLabel="Enviando…">
        Confirmar transferencia
      </Button>,
    );
    expect(screen.getByText('Confirmar transferencia')).toHaveClass('invisible');
  });

  it('WEB-23 no tiene problemas de accesibilidad en sus variantes y estados', async () => {
    const { container } = render(
      <div>
        <Button>Enviar</Button>
        <Button variant="secondary">Agregar beneficiario</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="destructive">Cerrar sesión</Button>
        <Button disabled>Deshabilitado</Button>
        <Button loading loadingLabel="Enviando…">
          Enviar
        </Button>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
