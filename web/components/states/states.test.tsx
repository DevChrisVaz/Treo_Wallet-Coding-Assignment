import { ProblemError } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ErrorState, LoadingState } from './states';

describe('LoadingState', () => {
  it('WEB-20 anuncia la carga a los lectores de pantalla con esqueletos ocultos', () => {
    const { container } = render(<LoadingState label="Cargando tus cuentas" variant="card" />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus cuentas');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('ErrorState', () => {
  it('WEB-20 muestra el error de la lectura y "Reintentar" repite la lectura', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={new ProblemError(500, { code: 'INTERNAL_ERROR', requestId: 'r9' })}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus cuentas');
    expect(alert).toHaveTextContent(problemMessage('INTERNAL_ERROR'));
    expect(alert).toHaveTextContent('r9');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('WEB-25 "Reintentar" va debajo de la alerta y no dentro, como en la app móvil', () => {
    render(
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={new TypeError('Failed to fetch')}
        onRetry={vi.fn()}
      />,
    );
    expect(within(screen.getByRole('alert')).queryByRole('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  it('WEB-23 no tienen problemas de accesibilidad', async () => {
    const { container } = render(
      <div>
        <LoadingState label="Cargando" />
        <ErrorState title="Error" error={new TypeError('Failed to fetch')} onRetry={vi.fn()} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
