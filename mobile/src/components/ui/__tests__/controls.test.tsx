import { focusRing } from '@devchrisvaz/wallet-design-tokens';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  test('MOB-20 un botón de selector anuncia si está elegido', async () => {
    await render(
      <>
        <Button label="Principal" variant="primary" selected onPress={() => {}} />
        <Button label="Ahorro" variant="secondary" selected={false} onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Principal' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ahorro' })).not.toBeSelected();
  });

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

  test('MOB-29 la variante de búsqueda lleva lupa, teclado de búsqueda y sin etiqueta visible', async () => {
    await render(
      <TextField
        label="Buscar beneficiario"
        variant="search"
        placeholder="Buscar por nombre, alias o CLABE"
        value=""
        onChangeText={() => {}}
      />,
    );
    const input = screen.getByLabelText('Buscar beneficiario');
    expect(input).toHaveProp('inputMode', 'search');
    expect(input).toHaveProp('placeholder', 'Buscar por nombre, alias o CLABE');
    expect(screen.queryByText('Buscar beneficiario')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();
  });

  test('MOB-29 con texto aparece el botón ×, que vacía la búsqueda', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="Buscar" variant="search" value="lu" onChangeText={onChangeText} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});

function ControlledAmount() {
  const [value, setValue] = useState('');
  return <AmountField label="Monto" value={value} onChangeText={setValue} />;
}

describe('AmountField', () => {
  test('DSG-11 MOB-08 tiene prefijo $, teclado decimal y da formato de miles al escribir y pegar', async () => {
    await render(<ControlledAmount />);
    expect(screen.getByText('$')).toBeOnTheScreen();
    const input = screen.getByLabelText('Monto');
    expect(input).toHaveProp('keyboardType', 'decimal-pad');
    await fireEvent.changeText(input, '1250.50');
    expect(input).toHaveDisplayValue('1,250.50');
    await fireEvent.changeText(input, 'abc$12,345.678xyz');
    expect(input).toHaveDisplayValue('12,345.67');
    await fireEvent.changeText(input, '007');
    expect(input).toHaveDisplayValue('7');
  });
});

describe('AmountField hero', () => {
  test('MOB-08 la variante héroe muestra el prefijo $ y da formato al valor pegado igual que la normal', async () => {
    const onChangeText = jest.fn();
    await render(<AmountField variant="hero" label="Monto" value="" onChangeText={onChangeText} />);
    expect(screen.getByText('$')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Monto'), 'x1250.50');
    expect(onChangeText).toHaveBeenCalledWith('1,250.50');
  });

  test('MOB-08 el campo del monto héroe mide su texto para que el $ quede junto al monto', async () => {
    await render(
      <AmountField variant="hero" label="Monto" value="1250.00" onChangeText={() => {}} />,
    );
    const mirror = screen.getByTestId('hero-amount-mirror', { includeHiddenElements: true });
    expect(mirror).toHaveTextContent('1250.00');
    expect(screen.queryByTestId('hero-amount-mirror')).toBeNull(); // oculto a los lectores de pantalla
    await fireEvent(mirror, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 180, height: 48 } },
    });
    expect(screen.getByLabelText('Monto')).toHaveStyle({ width: 180 + theme.spacing[1] });
  });

  test('MOB-08 en la variante héroe un monto largo no desborda la fila junto al $', async () => {
    await render(
      <AmountField
        variant="hero"
        label="Monto"
        value="123456789012345678.00"
        onChangeText={() => {}}
      />,
    );
    const mirror = screen.getByTestId('hero-amount-mirror', { includeHiddenElements: true });
    expect(mirror).toHaveStyle({ maxWidth: '100%' });
    await fireEvent(mirror, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 900, height: 48 } },
    });
    // El campo puede pedir más ancho que la fila, pero se encoge hasta caber al lado del $.
    expect(screen.getByLabelText('Monto')).toHaveStyle({
      width: 900 + theme.spacing[1],
      flexShrink: 1,
      minWidth: 0,
    });
  });

  test('DSG-06 el subrayado del monto héroe usa el ancho del anillo de foco', async () => {
    await render(<AmountField variant="hero" label="Monto" value="" onChangeText={() => {}} />);
    expect(screen.getByTestId('hero-amount-row')).toHaveStyle({
      borderBottomWidth: focusRing.width,
    });
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

  test('MOB-12 solo dígitos al escribir y al pegar, con teclado numérico y máximo 6', async () => {
    const onChangeText = jest.fn();
    await render(<OtpField value="" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Código de 6 dígitos');
    expect(input).toHaveProp('keyboardType', 'number-pad');
    await fireEvent.changeText(input, 'a1b2-c3');
    expect(onChangeText).toHaveBeenLastCalledWith('123');
    await fireEvent.changeText(input, 'abcdef');
    expect(onChangeText).toHaveBeenLastCalledWith('');
    await fireEvent.changeText(input, '12345678');
    expect(onChangeText).toHaveBeenLastCalledWith('123456');
  });

  test('DSG-09 los dígitos del código son tabulares y van a 8 px, como en la web', async () => {
    await render(<OtpField value="482913" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveStyle({
      fontVariant: ['tabular-nums'],
      letterSpacing: theme.spacing[2],
    });
  });
});

describe('Select', () => {
  const options = [
    { value: 'a1', label: 'Principal', description: '•••• 9719' },
    { value: 'a2', label: 'Ahorro', description: '•••• 1234' },
  ];

  const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };

  function ControlledSelect() {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <Select
          label="Cuenta de origen"
          placeholder="Elige una cuenta"
          options={options}
          value={value}
          onChange={setValue}
        />
      </SafeAreaProvider>
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
