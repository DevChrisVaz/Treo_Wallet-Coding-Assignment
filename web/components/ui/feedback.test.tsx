import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { EmptyState } from './EmptyState';
import { InlineAlert } from './InlineAlert';
import { Skeleton } from './Skeleton';
import { StatusBadge } from './StatusBadge';

describe('InlineAlert', () => {
  it('DSG-11 WEB-23 los errores usan role="alert" y el tono de error', () => {
    render(
      <InlineAlert tone="danger" title="Saldo insuficiente">
        No tienes saldo suficiente para esta transferencia.
      </InlineAlert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Saldo insuficiente');
    expect(alert).toHaveTextContent('No tienes saldo suficiente para esta transferencia.');
    expect(alert).toHaveClass('bg-danger-soft', 'text-danger');
  });

  it.each(['success', 'warning', 'info'] as const)(
    'DSG-11 el tono %s usa role="status"',
    (tone) => {
      render(<InlineAlert tone={tone}>Aviso</InlineAlert>);
      expect(screen.getByRole('status')).toHaveClass(`bg-${tone}-soft`, `text-${tone}`);
    },
  );

  it('WEB-23 puede recibir el foco al aparecer para anunciar el error', () => {
    render(
      <InlineAlert tone="danger" focusOnMount>
        Algo falló
      </InlineAlert>,
    );
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(
      <div>
        <InlineAlert tone="danger" title="Error">
          Mensaje
        </InlineAlert>
        <InlineAlert tone="success">Listo</InlineAlert>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('EmptyState', () => {
  it('WEB-20 DSG-11 muestra el título, la ayuda y la acción sugerida', () => {
    render(
      <EmptyState
        title="Aún no tienes beneficiarios"
        description="Agrega a quien le envías dinero con su CLABE."
        action={<button type="button">Agregar beneficiario</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Aún no tienes beneficiarios' })).toBeVisible();
    expect(screen.getByText('Agrega a quien le envías dinero con su CLABE.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Agregar beneficiario' })).toBeVisible();
  });
});

describe('Skeleton', () => {
  it('DSG-06 DSG-11 está oculto para lectores de pantalla y no pulsa con movimiento reducido', () => {
    const { container } = render(<Skeleton variant="card" />);
    const skeleton = container.firstElementChild;
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton).toHaveClass('animate-pulse', 'motion-reduce:animate-none');
  });
});

describe('StatusBadge', () => {
  it.each([
    ['PENDING_OTP', 'Pendiente de código', 'warning'],
    ['COMPLETED', 'Completada', 'success'],
    ['REJECTED', 'Rechazada', 'danger'],
    ['FAILED', 'Fallida', 'danger'],
    ['EXPIRED', 'Vencida', 'neutral'],
  ] as const)('DSG-10 %s muestra "%s" con el tono %s', (status, label, tone) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass(`bg-${tone}-soft`, `text-${tone}`, 'rounded-pill');
  });

  it.each([
    ['SCHEDULED', 'Programada', 'info'],
    ['CANCELLED', 'Cancelada', 'neutral'],
  ] as const)('WEB-34 DSG-18 %s muestra "%s" con el tono %s', (status, label, tone) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass(`bg-${tone}-soft`, `text-${tone}`, 'rounded-pill');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<StatusBadge status="COMPLETED" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
