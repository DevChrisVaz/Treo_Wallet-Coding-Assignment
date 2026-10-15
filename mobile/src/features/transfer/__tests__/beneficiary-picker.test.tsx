import { screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { createFakeApi, json, problem } from '@/test-utils/fake-api';
import { luis, mama } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';

import { BeneficiaryPickerScreen } from '../beneficiary-picker-screen';

function SendRoute() {
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId: string }>();
  return <Text>{`Captura para ${beneficiaryId}`}</Text>;
}

const routes = { 'transfer/index': BeneficiaryPickerScreen, 'transfer/send': SendRoute };

describe('elegir beneficiario', () => {
  test('MOB-07 muestra los beneficiarios registrados con alias, nombre y últimos 4 de la CLABE', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items: [luis, mama] }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });

    expect(
      await screen.findByRole('button', { name: 'Luis, Luis Pérez, CLABE terminación 5678' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Mamá, María Gómez, CLABE terminación 4321' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/646180157000005678/)).toBeNull();
  });

  test('MOB-07 elegir un beneficiario abre la captura de la transferencia para él', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items: [luis, mama] }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });

    await userEvent.press(await screen.findByRole('button', { name: /^Mamá/ }));

    expect(await screen.findByText(`Captura para ${mama.id}`)).toBeOnTheScreen();
  });

  test('MOB-07 sin beneficiarios indica registrarlos desde la web y no ofrece formulario de alta', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items: [] }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });

    expect(await screen.findByText('Aún no tienes beneficiarios')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryAllByRole('button').map((button) => button.props.accessibilityLabel),
    ).toEqual(['Salir de la transferencia']);
    expect(screen.queryByLabelText('CLABE')).toBeNull();
  });

  test('MOB-07 si la consulta falla muestra el error y permite reintentar', async () => {
    const fake = createFakeApi().on(
      'GET',
      '/beneficiaries',
      'network-error',
      json(200, { items: [luis] }),
    );
    await renderApp({ fake, routes, initialUrl: '/transfer' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos conectar/);
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /^Luis/ })).toBeOnTheScreen();
  });

  test('MOB-07 un error de la API muestra su mensaje por code', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', problem(500, 'INTERNAL_ERROR'));
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Folio para soporte/);
  });

  test('MOB-21 el destinatario es el paso 1 de 5 y lo anuncia', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items: [luis, mama] }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    expect(await screen.findByLabelText('Paso 1 de 5: Destinatario')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '¿A quién le envías?' })).toBeOnTheScreen();
  });

  test('MOB-21 si la consulta falla, el error dice qué lectura falló', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', 'network-error');
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    expect(await screen.findByText('No pudimos cargar tus beneficiarios')).toBeOnTheScreen();
  });
});

describe('buscar beneficiario (MOB-29)', () => {
  async function open(items = [luis, mama]) {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    return userEvent.setup();
  }

  test('MOB-29 filtra por nombre o alias sin distinguir mayúsculas ni acentos', async () => {
    const user = await open();
    const search = await screen.findByLabelText('Buscar beneficiario');
    expect(search).toHaveProp('placeholder', 'Buscar por nombre, alias o CLABE');

    await user.type(search, 'MARIA');
    expect(screen.getByRole('button', { name: /^Mamá/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Luis/ })).toBeNull();

    await user.clear(search);
    await user.type(search, 'lu');
    expect(screen.getByRole('button', { name: /^Luis/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Mamá/ })).toBeNull();
  });

  test('MOB-29 una consulta de dígitos busca dentro de la CLABE', async () => {
    const user = await open();
    await user.type(await screen.findByLabelText('Buscar beneficiario'), '4321');
    expect(screen.getByRole('button', { name: /^Mamá/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Luis/ })).toBeNull();
  });

  test('MOB-29 sin coincidencias muestra "Sin resultados" y "Limpiar búsqueda" restaura la lista', async () => {
    const user = await open();
    await user.type(await screen.findByLabelText('Buscar beneficiario'), 'zzz');

    expect(screen.getByText('Sin resultados')).toBeOnTheScreen();
    expect(screen.getByText('No hay beneficiarios que coincidan con «zzz».')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(screen.queryByText('Sin resultados')).toBeNull();
    expect(screen.getByRole('button', { name: /^Luis/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Mamá/ })).toBeOnTheScreen();
    expect(screen.getByLabelText('Buscar beneficiario')).toHaveDisplayValue('');
  });

  test('MOB-29 el botón × borra la búsqueda', async () => {
    const user = await open();
    await user.type(await screen.findByLabelText('Buscar beneficiario'), 'lu');
    await user.press(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(screen.getByLabelText('Buscar beneficiario')).toHaveDisplayValue('');
    expect(screen.getByRole('button', { name: /^Mamá/ })).toBeOnTheScreen();
  });

  test('MOB-29 sin beneficiarios no hay campo de búsqueda', async () => {
    await open([]);
    expect(await screen.findByText('Aún no tienes beneficiarios')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Buscar beneficiario')).toBeNull();
  });
});
