import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { theme } from '@/theme';

import { AmountField, Button, buttonColors, OtpField, Select, TextField, Wordmark } from '..';

describe('Wordmark', () => {
  test('DSG-11 muestra "TreoWallet" con Treo en tinta y Wallet en verde profundo', async () => {
    await render(<Wordmark />);
    expect(screen.getByLabelText('TreoWallet')).toBeOnTheScreen();
    expect(screen.getByText('Treo')).toHaveStyle({ color: theme.colors.text.primary });
    expect(screen.getByText('Wallet')).toHaveStyle({ color: theme.colors.action.primary });
  });

  test('DSG-11 sobre la superficie invertida todo el logotipo va en text.onInverse', async () => {
    await render(<Wordmark tone="inverse" />);
    expect(screen.getByText('Treo')).toHaveStyle({ color: theme.colors.text.onInverse });
    expect(screen.getByText('Wallet')).toHaveStyle({ color: theme.colors.text.onInverse });
  });
});

describe('Button', () => {
  test('DSG-02 el botón principal en reposo es verde profundo, con texto blanco y en píldora', async () => {
    await render(<Button label="Enviar" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveStyle({
      backgroundColor: '#1C4B42',
      borderRadius: theme.radius.pill,
      minHeight: theme.spacing[12],
    });
    expect(screen.getByText('Enviar')).toHaveStyle({ color: '#FFFFFF' });
  });

  test('DSG-02 el botón principal presionado es lima con texto verde profundo', () => {
    expect(buttonColors('primary', { pressed: true, disabled: false })).toEqual({
      background: '#B4E717',
      text: '#1C4B42',
      border: '#B4E717',
    });
  });

  test('DSG-03 cada variante usa solo tokens semánticos', () => {
    const idle = { pressed: false, disabled: false };
    expect(buttonColors('secondary', idle)).toEqual({
      background: theme.colors.surface.default,
      text: theme.colors.action.primary,
      border: theme.colors.action.primary,
    });
    expect(buttonColors('destructive', idle).text).toBe(theme.colors.status.danger.fg);
    expect(buttonColors('ghost', idle).background).toBe('transparent');
    expect(buttonColors('primary', { pressed: false, disabled: true })).toEqual({
      background: theme.colors.action.disabled,
      text: theme.colors.text.disabled,
      border: theme.colors.action.disabled,
    });
  });

  test('DSG-11 enviando: se deshabilita, conserva su tamaño y anuncia que está en curso', async () => {
    const onPress = jest.fn();
    await render(<Button label="Enviar" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    expect(button).toHaveStyle({ minHeight: theme.spacing[12] });
    expect(screen.getByText('Enviar')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  test('DSG-11 un campo con error muestra el mensaje debajo, en tono de error y asociado al campo', async () => {
    await render(
      <TextField label="Correo" value="ana@" onChangeText={() => {}} error="Correo inválido" />,
    );
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveProp('accessibilityHint', 'Correo inválido');
    expect(input).toHaveStyle({ borderColor: theme.colors.status.danger.fg });
    expect(screen.getByText('Correo inválido')).toHaveStyle({
      color: theme.colors.status.danger.fg,
    });
  });

  test('DSG-06 al recibir foco muestra el borde de foco del sistema', async () => {
    await render(<TextField label="Correo" value="" onChangeText={() => {}} />);
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveStyle({ borderColor: theme.colors.border.input });
    await fireEvent(input, 'focus');
    expect(input).toHaveStyle({ borderColor: theme.colors.border.focus, borderWidth: 2 });
  });

  test('DSG-11 la variante de contraseña oculta el texto', async () => {
    await render(
      <TextField label="Contraseña" variant="password" value="x" onChangeText={() => {}} />,
    );
    expect(screen.getByLabelText('Contraseña')).toHaveProp('secureTextEntry', true);
  });
});

function ControlledAmount() {
  const [value, setValue] = useState('');
  return <AmountField label="Monto" value={value} onChangeText={setValue} />;
}

describe('AmountField', () => {
  test('DSG-11 tiene prefijo $, teclado decimal y entrega el valor como string sin separadores', async () => {
    await render(<ControlledAmount />);
    expect(screen.getByText('$')).toBeOnTheScreen();
    const input = screen.getByLabelText('Monto');
    expect(input).toHaveProp('keyboardType', 'decimal-pad');
    await fireEvent.changeText(input, '1,250.50');
    expect(input).toHaveDisplayValue('1250.50');
  });
});

describe('OtpField', () => {
  test('DSG-11 acepta pegar el código, se queda con 6 dígitos y se ofrece al autocompletado', async () => {
    const onChangeText = jest.fn();
    await render(<OtpField value="" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Código de 6 dígitos');
    expect(input).toHaveProp('textContentType', 'oneTimeCode');
    expect(input).toHaveProp('autoComplete', 'one-time-code');
    expect(input).toHaveProp('maxLength', 6);
    await fireEvent.changeText(input, '482 913');
    expect(onChangeText).toHaveBeenCalledWith('482913');
  });
});

describe('Select', () => {
  const options = [
    { value: 'a1', label: 'Principal', description: '•••• 9719' },
    { value: 'a2', label: 'Ahorro', description: '•••• 1234' },
  ];

  function ControlledSelect() {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <Select
        label="Cuenta de origen"
        placeholder="Elige una cuenta"
        options={options}
        value={value}
        onChange={setValue}
      />
    );
  }

  test('DSG-11 abre la lista en una hoja inferior y marca la opción elegida', async () => {
    const user = userEvent.setup();
    await render(<ControlledSelect />);
    await user.press(screen.getByRole('button', { name: /Cuenta de origen/ }));
    await user.press(screen.getByRole('button', { name: /^Ahorro/ }));
    expect(screen.queryByRole('button', { name: /Principal/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Cuenta de origen/ })).toHaveTextContent(/Ahorro/);
    await user.press(screen.getByRole('button', { name: /Cuenta de origen/ }));
    expect(screen.getByRole('button', { name: /^Ahorro/ })).toBeSelected();
  });
});
