import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AHORRO, DAILY_LIMIT, PRINCIPAL, movement, transfer } from '@/test/fixtures';
import { AccountCard } from './AccountCard';
import { DailyLimitMeter } from './DailyLimitMeter';
import { MovementRow } from './MovementRow';
import { Receipt } from './Receipt';

describe('AccountCard', () => {
  it('WEB-13 WEB-21 muestra el nombre, la CLABE enmascarada y el saldo con formatMXN', () => {
    render(<AccountCard account={PRINCIPAL} />);
    const card = screen.getByRole('article', { name: 'Principal' });
    expect(within(card).getByText('$25,000.00')).toHaveClass('text-display', 'tabular-nums');
    expect(card).toHaveTextContent('•••• 9719');
    expect(card).not.toHaveTextContent('032180000118359719');
  });

  it('WEB-13 permite ver la CLABE completa para compartirla', async () => {
    const user = userEvent.setup();
    render(<AccountCard account={PRINCIPAL} />);
    await user.click(screen.getByRole('button', { name: 'Mostrar CLABE de Principal' }));
    expect(screen.getByText('CLABE 032180000118359719')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ocultar CLABE de Principal' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('DSG-11 usa la superficie de marca con radio mediano y marca la cuenta seleccionada', () => {
    render(<AccountCard account={AHORRO} selected />);
    const card = screen.getByRole('article', { name: 'Ahorro' });
    expect(card).toHaveClass('bg-surface-brand', 'rounded-md', 'ring-2', 'ring-action');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<AccountCard account={PRINCIPAL} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('MovementRow', () => {
  function renderRow(props: Parameters<typeof MovementRow>[0]) {
    return render(
      <ul>
        <MovementRow {...props} />
      </ul>,
    );
  }

  it('DSG-09 una transferencia recibida se ve como +$150.00 con el color de dinero entrante', () => {
    renderRow({ movement: movement({ type: 'TRANSFER_IN', amount: '150.00' }) });
    expect(screen.getByText('+$150.00')).toHaveClass('text-money-in', 'tabular-nums');
    expect(screen.getByText('Transferencia recibida')).toBeVisible();
  });

  it('DSG-09 una transferencia enviada se ve como −$150.00 con la tinta, no con el color de error', () => {
    renderRow({ movement: movement({ type: 'TRANSFER_OUT', amount: '-150.00' }) });
    const amount = screen.getByText('−$150.00');
    expect(amount).toHaveClass('text-money-out');
    expect(amount).not.toHaveClass('text-danger');
  });

  it('DSG-10 un traspaso entre cuentas propias se etiqueta "Traspaso enviado"', () => {
    renderRow({ movement: movement({ type: 'OWN_TRANSFER_OUT', amount: '-3000.00' }) });
    expect(screen.getByText('Traspaso enviado')).toBeVisible();
  });

  it('WEB-14 muestra fecha, concepto, referencia, contraparte y saldo después del movimiento', () => {
    renderRow({ movement: movement() });
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('Luis Pérez');
    expect(row).toHaveTextContent('Renta de octubre');
    expect(row).toHaveTextContent('Ref. 1234');
    expect(row).toHaveTextContent('13 oct 2026, 10:42');
    expect(row).toHaveTextContent('Saldo: $26,500.00');
  });

  it('WEB-14 un depósito sin contraparte muestra solo el concepto', () => {
    renderRow({
      movement: movement({ type: 'DEPOSIT', counterparty: null, concept: 'Depósito inicial' }),
    });
    expect(screen.getByRole('listitem')).toHaveTextContent('Depósito inicial');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderRow({ movement: movement() });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Receipt', () => {
  it('WEB-16 DSG-11 muestra estado, monto, origen, destino, concepto, referencia, fecha y folio', () => {
    render(<Receipt transfer={transfer()} fromAccount={PRINCIPAL} />);
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Completada')).toHaveClass('bg-success-soft');
    expect(within(receipt).getByText('$5,000.00')).toBeVisible();
    expect(receipt).toHaveTextContent('Principal •••• 9719');
    expect(receipt).toHaveTextContent('Luis •••• 9735');
    expect(receipt).toHaveTextContent('Renta');
    expect(receipt).toHaveTextContent('Referencia1');
    expect(receipt).toHaveTextContent('13 oct 2026, 10:42');
    expect(receipt).toHaveTextContent('4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e');
  });

  it('WEB-34 muestra la fecha programada en palabras cuando existe', () => {
    render(
      <Receipt
        transfer={transfer({ status: 'SCHEDULED', scheduledFor: '2026-10-20', completedAt: null })}
        fromAccount={PRINCIPAL}
      />,
    );
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(receipt).toHaveTextContent('Programada para20 de octubre de 2026');
    expect(within(receipt).getByText('20 de octubre de 2026')).toHaveAttribute(
      'dateTime',
      '2026-10-20',
    );
  });

  it('WEB-34 una transferencia inmediata no muestra fecha programada', () => {
    render(<Receipt transfer={transfer()} fromAccount={PRINCIPAL} />);
    expect(screen.getByRole('region', { name: 'Comprobante' })).not.toHaveTextContent(
      'Programada para',
    );
  });

  it('WEB-16 sin los datos de la cuenta de origen muestra su identificador', () => {
    render(<Receipt transfer={transfer()} />);
    expect(screen.getByRole('region', { name: 'Comprobante' })).toHaveTextContent(PRINCIPAL.id);
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<Receipt transfer={transfer()} fromAccount={PRINCIPAL} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DailyLimitMeter', () => {
  it('WEB-13 muestra "Te quedan $X hoy" con el restante que devuelve la API', () => {
    render(<DailyLimitMeter dailyLimit={DAILY_LIMIT} />);
    expect(screen.getByText('Te quedan $38,000.00 hoy')).toHaveClass('text-fg-secondary');
  });

  it('DSG-11 es un medidor accesible con el porcentaje usado y la barra en el acento', () => {
    render(<DailyLimitMeter dailyLimit={DAILY_LIMIT} />);
    const meter = screen.getByRole('meter', { name: 'Límite diario' });
    expect(meter).toHaveAttribute('aria-valuenow', '24');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuetext', 'Usaste $12,000.00 de $50,000.00');
    const fill = meter.querySelector('[data-meter-fill]');
    expect(fill).toHaveClass('bg-accent');
    expect(fill).toHaveStyle({ width: '24%' });
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(<DailyLimitMeter dailyLimit={DAILY_LIMIT} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
