import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AHORRO, BENEFICIARY, PRINCIPAL } from '@/test/fixtures';
import { RecipientStep } from './RecipientStep';

function renderStep(props: Partial<Parameters<typeof RecipientStep>[0]> = {}) {
  const onChoose = vi.fn();
  const view = render(
    <RecipientStep
      accounts={[PRINCIPAL, AHORRO]}
      beneficiaries={[BENEFICIARY]}
      onChoose={onChoose}
      {...props}
    />,
  );
  return { ...view, onChoose, user: userEvent.setup() };
}

describe('RecipientStep', () => {
  it('WEB-30 ofrece todas las cuentas propias y los beneficiarios (R38)', () => {
    renderStep();
    expect(screen.getByRole('heading', { name: 'Tus cuentas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Principal/ })).toHaveAccessibleName(
      /CLABE •••• 9719 · \$25,000\.00/,
    );
    expect(screen.getByRole('button', { name: /^Ahorro/ })).toHaveAccessibleName(
      /CLABE •••• 9722 · \$10,000\.00/,
    );
    expect(screen.getByRole('heading', { name: 'Beneficiarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Luis/ })).toHaveAccessibleName(
      /Luis Pérez Ramírez · CLABE •••• 9735/,
    );
  });

  it('WEB-30 elegir una cuenta propia continúa como traspaso entre cuentas propias', async () => {
    const { user, onChoose } = renderStep();
    await user.click(screen.getByRole('button', { name: /^Ahorro/ }));
    expect(onChoose).toHaveBeenCalledWith({
      destinationType: 'OWN_ACCOUNT',
      toAccountId: AHORRO.id,
    });
  });

  it('WEB-30 elegir un beneficiario continúa con él', async () => {
    const { user, onChoose } = renderStep();
    await user.click(screen.getByRole('button', { name: /^Luis/ }));
    expect(onChoose).toHaveBeenCalledWith({
      destinationType: 'BENEFICIARY',
      beneficiaryId: BENEFICIARY.id,
    });
  });

  it('WEB-15 sin beneficiarios sugiere agregar uno', () => {
    renderStep({ beneficiaries: [] });
    expect(screen.getByRole('link', { name: 'Agregar beneficiario' })).toHaveAttribute(
      'href',
      '/beneficiaries/new',
    );
  });

  it('WEB-34 WEB-27 en teléfono lleva a las transferencias programadas, que no son pestaña', () => {
    renderStep();
    const link = screen.getByRole('link', { name: 'Transferencias programadas' });
    expect(link).toHaveAttribute('href', '/transfers/scheduled');
    // Secundario y solo en la forma de app: en el dashboard lo da la navegación lateral.
    expect(link).toHaveClass('text-action', 'dashboard:hidden');
  });

  it('WEB-34 también sin beneficiarios ofrece las transferencias programadas', () => {
    renderStep({ beneficiaries: [] });
    expect(screen.getByRole('link', { name: 'Transferencias programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderStep();
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('búsqueda de beneficiarios (WEB-36)', () => {
    const MAMA = {
      ...BENEFICIARY,
      id: '7c2e1a0f-9d8c-4b7a-8f6e-5d4c3b2a1f0e',
      name: 'María Gómez',
      alias: 'Mamá',
      clabe: '032180000118359791',
    };

    it('WEB-36 filtra solo los beneficiarios; las cuentas propias siguen a la vista', async () => {
      const { user } = renderStep({ beneficiaries: [BENEFICIARY, MAMA] });
      await user.type(screen.getByRole('searchbox', { name: 'Buscar beneficiarios' }), 'mar');

      expect(screen.getByRole('button', { name: /^Mamá/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Luis/ })).toBeNull();
      expect(screen.getByRole('button', { name: /^Principal/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Ahorro/ })).toBeInTheDocument();
    });

    it('WEB-36 elegir un beneficiario filtrado continúa con él', async () => {
      const { user, onChoose } = renderStep({ beneficiaries: [BENEFICIARY, MAMA] });
      await user.type(screen.getByRole('searchbox', { name: 'Buscar beneficiarios' }), '9791');
      await user.click(screen.getByRole('button', { name: /^Mamá/ }));
      expect(onChoose).toHaveBeenCalledWith({
        destinationType: 'BENEFICIARY',
        beneficiaryId: MAMA.id,
      });
    });

    it('WEB-36 sin coincidencias muestra "Sin resultados" sin quitar las cuentas propias y "Limpiar búsqueda" restaura la lista', async () => {
      const { user } = renderStep({ beneficiaries: [BENEFICIARY, MAMA] });
      const field = screen.getByRole('searchbox', { name: 'Buscar beneficiarios' });
      await user.type(field, 'Zapata');

      expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
      expect(screen.getByText('No hay beneficiarios que coincidan con «Zapata».')).toBeVisible();
      expect(screen.getByRole('button', { name: /^Principal/ })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
      expect(field).toHaveValue('');
      expect(screen.getByRole('button', { name: /^Luis/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Mamá/ })).toBeInTheDocument();
    });

    it('WEB-36 sin beneficiarios no hay campo de búsqueda', () => {
      renderStep({ beneficiaries: [] });
      expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('WEB-23 el estado sin resultados no tiene problemas de accesibilidad', async () => {
      const { user, container } = renderStep({ beneficiaries: [BENEFICIARY, MAMA] });
      await user.type(screen.getByRole('searchbox', { name: 'Buscar beneficiarios' }), 'Zapata');
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
