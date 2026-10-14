import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet';
import { FlowHeader } from './FlowHeader';
import { StepActions } from './StepActions';
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
    expect(dialog).toHaveClass('flex', 'flex-col', 'max-h-[85dvh]');
    expect(screen.getByText('Contenido largo').parentElement).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
    );
  });
});

describe('BottomSheet fondo y fechas', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('DSG-17 mientras está abierta bloquea el desplazamiento de la página y al cerrar deja el valor que había', async () => {
    document.body.style.overflow = 'clip';
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('clip');
  });

  describe('con una barra de desplazamiento clásica (escritorio)', () => {
    /** La ventana mide 1024 px y la página, sin la barra, `clientWidth`. */
    function viewport(clientWidth: number) {
      vi.stubGlobal('innerWidth', 1024);
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        value: clientWidth,
      });
    }

    afterEach(() => {
      // Vuelve al getter de Element.prototype.
      Reflect.deleteProperty(document.documentElement, 'clientWidth');
      document.body.style.paddingRight = '';
    });

    it('DSG-17 al bloquear el fondo compensa con relleno a la derecha el ancho de la barra, para que la página no se mueva, y al cerrar lo quita', async () => {
      viewport(1009);
      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.body.style.paddingRight).toBe('15px');
      await userEvent.keyboard('{Escape}');
      expect(document.body.style.paddingRight).toBe('');
    });

    it('DSG-17 con barras superpuestas (teléfono) no agrega relleno', async () => {
      viewport(1024);
      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.body.style.paddingRight).toBe('');
    });
  });

  it('DSG-17 Escape dentro de un campo de fecha u hora no la cierra (cierra el selector del campo)', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Filtrar movimientos">
        <label>
          Desde
          <input type="date" />
        </label>
        <label>
          Hora
          <input type="time" />
        </label>
        <label>
          Concepto
          <input type="text" />
        </label>
      </BottomSheet>,
    );
    await userEvent.click(screen.getByLabelText('Desde'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByLabelText('Hora'));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Concepto'));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('WEB-23 al cambiar de paso el título recibe el foco; al abrir la página, no', () => {
    const { rerender } = render(
      <FlowHeader
        title="¿A quién le envías?"
        step={1}
        total={5}
        stepLabel="Destinatario"
        closeHref="/"
        titleId="t"
        focusTitle
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
    rerender(
      <FlowHeader
        title="¿Cuánto envías?"
        step={2}
        total={5}
        stepLabel="Monto"
        closeHref="/"
        titleId="t"
        focusTitle
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 't');
  });
});

describe('Stepper', () => {
  it('WEB-30 anuncia el paso actual una sola vez', () => {
    render(<Stepper current={3} total={5} label="Revisión" />);
    expect(screen.getByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('StepActions', () => {
  it('WEB-30 en teléfono las acciones del paso quedan fijas abajo y un espaciador reserva su alto', () => {
    const { container } = render(
      <StepActions stacked>
        <button type="button">Enviar</button>
      </StepActions>,
    );
    expect(screen.getByRole('button', { name: 'Enviar' }).closest('.fixed')).toHaveClass(
      'inset-x-0',
      'bottom-0',
      'dashboard:static',
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('h-36', 'dashboard:hidden');
  });

  it('WEB-30 en una página con pestañas las acciones van en línea', () => {
    render(
      <StepActions fixed={false}>
        <button type="button">Ver mis cuentas</button>
      </StepActions>,
    );
    expect(screen.getByRole('button', { name: 'Ver mis cuentas' }).closest('.fixed')).toBeNull();
  });
});
