import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';
import { FlowHeader } from './FlowHeader';
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

  it('DSG-17 un clic en el título no deja el foco fuera: Tab queda dentro y Escape cierra', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Filtros' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Filtrar movimientos' });
    await userEvent.click(screen.getByRole('heading', { name: 'Filtrar movimientos' }));
    await userEvent.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('DSG-17 Shift+Tab desde el primer control da la vuelta al último', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar movimientos' });
    const focusables = within(dialog).getAllByRole('button');
    expect(focusables[0]).toHaveFocus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(focusables[focusables.length - 1]).toHaveFocus();
  });
});

describe('BottomSheet R16', () => {
  it('DSG-17 limita la altura y el cuerpo del panel se desplaza', () => {
    render(
      <BottomSheet open onClose={() => undefined} title="Filtrar movimientos">
        <p>Contenido largo</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Filtrar movimientos' });
    expect(dialog).toHaveClass('max-h-[85dvh]');
    expect(screen.getByText('Contenido largo').parentElement).toHaveClass('overflow-y-auto');
  });
});

describe('FlowHeader', () => {
  it('DSG-17 el enlace de salir tiene nombre accesible y destino', () => {
    render(
      <FlowHeader title="Transferir" step={1} total={3} stepLabel="Destino" closeHref="/inicio" />,
    );
    const close = screen.getByRole('link', { name: 'Salir de la transferencia' });
    expect(close).toHaveAttribute('href', '/inicio');
  });

  it('WEB-25 no trae margen lateral propio: el de 20 px lo da el contenido de AppShell, como en móvil', () => {
    render(
      <FlowHeader title="Transferir" step={1} total={3} stepLabel="Destino" closeHref="/inicio" />,
    );
    const header = screen.getByRole('heading', { level: 1, name: 'Transferir' }).closest('header');
    expect(header?.className).not.toMatch(/(^|\s)px-/);
    expect(header).toHaveClass('pt-4', 'dashboard:pt-8');
  });
});

describe('Stepper', () => {
  it('WEB-30 anuncia el paso actual', () => {
    render(<Stepper current={3} total={5} label="Revisión" />);
    expect(screen.getByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('group', { name: 'Paso 3 de 5: Revisión' })).toBeInTheDocument();
  });
});
