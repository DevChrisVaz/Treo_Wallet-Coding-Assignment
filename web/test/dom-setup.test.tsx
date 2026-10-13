import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

describe('entorno de pruebas de componentes', () => {
  it('WEB-23 vitest-axe reporta un campo sin etiqueta', async () => {
    const { container } = render(<input type="text" />);
    const results = await axe(container);
    expect(results.violations.map((violation) => violation.id)).toContain('label');
  });

  it('WEB-23 vitest-axe acepta un campo con etiqueta asociada', async () => {
    const { container } = render(
      <>
        <label htmlFor="monto">Monto</label>
        <input id="monto" type="text" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WEB-23 Testing Library y user-event manejan el foco con el teclado', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus();
  });
});
