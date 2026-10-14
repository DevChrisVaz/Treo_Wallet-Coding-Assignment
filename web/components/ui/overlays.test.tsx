import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';
import { Stepper } from './Stepper';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Filtros
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Filtrar movimientos">
        <button type="button">Aplicar</button>
        <button type="button">Limpiar</button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('DSG-17 mueve el foco adentro y no deja que Tab salga', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar movimientos' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 5; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('DSG-17 Escape cierra y regresa el foco al control que la abrió', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Filtros' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe('Stepper', () => {
  it('WEB-30 anuncia el paso actual', () => {
    render(<Stepper current={3} total={5} label="Revisión" />);
    expect(screen.getByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('group', { name: 'Paso 3 de 5: Revisión' })).toBeInTheDocument();
  });
});
