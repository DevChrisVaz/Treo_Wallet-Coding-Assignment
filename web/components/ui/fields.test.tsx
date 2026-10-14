import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AmountField } from './AmountField';
import { OtpField } from './OtpField';
import { Select } from './Select';
import { TextField } from './TextField';

describe('TextField', () => {
  it('DSG-11 WEB-23 tiene la etiqueta visible asociada y la ayuda en su descripción', () => {
    render(
      <TextField label="Correo" type="email" hint="Usa el correo con el que te registraste" />,
    );
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAccessibleDescription('Usa el correo con el que te registraste');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('DSG-11 con error: marca el campo inválido y asocia el mensaje con el tono de error', () => {
    render(<TextField label="Correo" error="El correo no tiene un formato válido" />);
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('El correo no tiene un formato válido');
    expect(screen.getByText('El correo no tiene un formato válido')).toHaveClass('text-danger');
  });

  it('WEB-23 DSG-06 usa el borde de campo del sistema, alto de 52 px y foco visible', () => {
    render(<TextField label="Nombre" />);
    expect(screen.getByLabelText('Nombre')).toHaveClass('border-border-input', 'min-h-13');
  });

  it('WEB-23 no tiene problemas de accesibilidad en reposo, error y deshabilitado', async () => {
    const { container } = render(
      <form>
        <TextField label="Correo" type="email" />
        <TextField label="Contraseña" type="password" error="La contraseña es obligatoria" />
        <TextField label="Nombre" disabled />
      </form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AmountField', () => {
  it('WEB-21 DSG-11 es un campo de texto decimal con prefijo $ y conserva el valor como texto', async () => {
    const user = userEvent.setup();
    render(<AmountField label="Monto" />);
    const input = screen.getByLabelText('Monto');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByText('$')).toHaveAttribute('aria-hidden', 'true');
    await user.type(input, '1,250.50');
    expect(input).toHaveValue('1,250.50');
  });

  it('WEB-30 en la variante hero el campo mide lo que su texto, así "$" y el monto quedan juntos al centro', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountField label="Monto" variant="hero" onChange={onChange} />);
    const input = screen.getByLabelText('Monto');
    // El espejo invisible da el ancho y el campo lo cubre (WEB-25: como en la app móvil).
    const mirror = screen.getByTestId('hero-amount-mirror');
    expect(mirror).toHaveAttribute('aria-hidden', 'true');
    expect(input).toHaveClass('absolute', 'inset-0');
    expect(mirror.textContent).toBe('0');
    await user.type(input, '1,250');
    expect(input).toHaveValue('1,250');
    expect(mirror.textContent).toBe('1,250');
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('WEB-30 en la variante hero el ancho inicial sale de defaultValue', () => {
    render(<AmountField label="Monto" variant="hero" defaultValue="1,250.00" />);
    expect(screen.getByTestId('hero-amount-mirror').textContent).toBe('1,250.00');
  });

  it('WEB-30 en la variante hero con valor controlado el espejo sigue a `value`', () => {
    render(<AmountField label="Monto" variant="hero" value="15000" onChange={vi.fn()} />);
    expect(screen.getByTestId('hero-amount-mirror').textContent).toBe('15000');
  });

  it('WEB-30 en la variante hero un monto largo no desborda la fila: columna minmax(0,1fr) y espejo recortado', () => {
    render(<AmountField label="Monto" variant="hero" defaultValue="123456789012345678.00" />);
    const mirror = screen.getByTestId('hero-amount-mirror');
    expect(mirror).toHaveClass('max-w-full', 'overflow-x-clip');
    expect(mirror.closest('.grid')).toHaveClass('grid-cols-1');
  });

  it('WEB-23 no tiene problemas de accesibilidad con error', async () => {
    const { container } = render(
      <AmountField label="Monto" error="El monto admite máximo 2 decimales" />,
    );
    expect(screen.getByLabelText('Monto')).toHaveAccessibleDescription(
      'El monto admite máximo 2 decimales',
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('OtpField', () => {
  it('DSG-11 es un solo campo numérico de código de un solo uso', () => {
    render(<OtpField label="Código de 6 dígitos" />);
    const input = screen.getByLabelText('Código de 6 dígitos');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveClass('tabular-nums');
  });

  it('WEB-25 ocupa el ancho del formulario con el texto del campo, como en la app móvil', () => {
    render(<OtpField label="Código de 6 dígitos" />);
    const input = screen.getByLabelText('Código de 6 dígitos');
    expect(input).toHaveClass('w-full', 'text-body', 'tracking-[0.5em]');
    expect(input).not.toHaveClass('max-w-56');
  });

  it('DSG-11 acepta pegar el código completo', async () => {
    const user = userEvent.setup();
    render(<OtpField label="Código" />);
    const input = screen.getByLabelText('Código');
    await user.click(input);
    await user.paste('482913');
    expect(input).toHaveValue('482913');
  });

  it('WEB-23 no tiene problemas de accesibilidad con error y deshabilitado', async () => {
    const { container } = render(
      <div>
        <OtpField label="Código" error="El código debe tener 6 dígitos" />
        <OtpField label="Código anterior" disabled />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Select', () => {
  it('DSG-11 WEB-23 es un select nativo con etiqueta y error asociados', async () => {
    const user = userEvent.setup();
    render(
      <Select label="Cuenta de origen" error="Elige una cuenta">
        <option value="">Elige una cuenta</option>
        <option value="a">Principal</option>
        <option value="b">Ahorro</option>
      </Select>,
    );
    const select = screen.getByLabelText('Cuenta de origen');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Elige una cuenta');
    await user.selectOptions(select, 'b');
    expect(select).toHaveValue('b');
  });

  it('WEB-25 lleva el chevron del sistema en lugar de la flecha del navegador', () => {
    const { container } = render(
      <Select label="Cuenta">
        <option value="a">Principal</option>
      </Select>,
    );
    expect(screen.getByLabelText('Cuenta')).toHaveClass('appearance-none');
    expect(container.querySelector('select + svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = render(
      <Select label="Cuenta">
        <option value="a">Principal</option>
      </Select>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
