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

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderStep();
    expect(await axe(container)).toHaveNoViolations();
  });
});
