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
      await screen.findByRole('button', { name: 'Luis, Luis Pérez · CLABE •••• 5678' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Mamá, María Gómez · CLABE •••• 4321' }),
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
    ).toEqual(['Cancelar']);
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
});
