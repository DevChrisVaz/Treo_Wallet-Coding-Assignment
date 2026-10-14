import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { parseApiUrl, readApiUrl } from '../api-url';
import { ConfigGate } from '../config-gate';

describe('URL de la API', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  test('MOB-17 acepta la IP de la red local con puerto y quita la diagonal final', () => {
    expect(parseApiUrl('http://192.168.1.50:4000/')).toEqual({
      ok: true,
      baseUrl: 'http://192.168.1.50:4000',
    });
    expect(parseApiUrl('http://10.0.2.2:4000')).toEqual({
      ok: true,
      baseUrl: 'http://10.0.2.2:4000',
    });
    expect(parseApiUrl(' https://api.treowallet.mx/v1 ')).toEqual({
      ok: true,
      baseUrl: 'https://api.treowallet.mx/v1',
    });
  });

  test('MOB-17 informa cuando la URL falta', () => {
    expect(parseApiUrl(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(parseApiUrl('   ')).toEqual({ ok: false, reason: 'missing' });
  });

  test('MOB-17 rechaza lo que no es una URL http(s)', () => {
    for (const value of ['192.168.1.50:4000', 'ftp://192.168.1.50', 'http://', 'http://a b']) {
      expect(parseApiUrl(value)).toEqual({ ok: false, reason: 'invalid', value: value.trim() });
    }
  });

  test('MOB-17 lee EXPO_PUBLIC_API_URL de la configuración del proyecto', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.50:4000';
    expect(readApiUrl()).toEqual({ ok: true, baseUrl: 'http://192.168.1.50:4000' });
  });

  test('MOB-17 sin URL configurada muestra un error de configuración claro en lugar de la app', async () => {
    await render(
      <ConfigGate config={parseApiUrl(undefined)}>
        {() => <Text>Contenido de la app</Text>}
      </ConfigGate>,
    );
    expect(screen.getByText('Falta configurar la API')).toBeOnTheScreen();
    expect(screen.getByText(/EXPO_PUBLIC_API_URL/)).toBeOnTheScreen();
    expect(screen.queryByText('Contenido de la app')).toBeNull();
  });

  test('MOB-17 con una URL inválida muestra el valor recibido', async () => {
    await render(
      <ConfigGate config={parseApiUrl('192.168.1.50:4000')}>
        {() => <Text>Contenido de la app</Text>}
      </ConfigGate>,
    );
    expect(screen.getByText('La URL de la API no es válida')).toBeOnTheScreen();
    expect(screen.getByText('Valor recibido: 192.168.1.50:4000')).toBeOnTheScreen();
  });

  test('MOB-17 con una URL válida muestra la app y le entrega la URL base', async () => {
    await render(
      <ConfigGate config={parseApiUrl('http://192.168.1.50:4000')}>
        {(baseUrl) => <Text>{`API en ${baseUrl}`}</Text>}
      </ConfigGate>,
    );
    expect(screen.getByText('API en http://192.168.1.50:4000')).toBeOnTheScreen();
  });
});
