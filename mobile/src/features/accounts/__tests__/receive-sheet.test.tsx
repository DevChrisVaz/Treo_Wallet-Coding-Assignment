import { screen, userEvent, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Share, Text } from 'react-native';

import { createFakeApi, json } from '@/test-utils/fake-api';
import { ahorro, me, overview, principal } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';

import { HomeScreen } from '../home-screen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const routes = {
  index: HomeScreen,
  movements: () => <Text>Movimientos</Text>,
  'transfer/index': () => <Text>Elegir beneficiario</Text>,
};

function homeApi() {
  return createFakeApi()
    .on('GET', '/me', json(200, me))
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', `/accounts/${principal.id}/movements`, json(200, { items: [], nextCursor: null }))
    .on('GET', `/accounts/${ahorro.id}/movements`, json(200, { items: [], nextCursor: null }));
}

async function openSheet() {
  await renderApp({ fake: homeApi(), routes });
  const user = userEvent.setup();
  await screen.findByText('$25,000.00');
  await user.press(screen.getByRole('button', { name: 'Recibir' }));
  const sheet = await screen.findByTestId('bottom-sheet');
  return { user, sheet: within(sheet) };
}

const grouped = (clabe: string) => clabe.replace(/(\d{4})(?=\d)/g, '$1 ');

describe('Recibir dinero (MOB-28)', () => {
  test('MOB-19 la acción rápida "Recibir" va después de "Transferir" y antes de "Movimientos"', async () => {
    await renderApp({ fake: homeApi(), routes });
    await screen.findByText('$25,000.00');
    const names = ['Transferir', 'Recibir', 'Movimientos'].map((name) =>
      screen.getByRole('button', { name }),
    );
    expect(names).toHaveLength(3);
    const all = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(all.indexOf('Transferir')).toBeLessThan(all.indexOf('Recibir'));
    expect(all.indexOf('Recibir')).toBeLessThan(all.indexOf('Movimientos'));
  });

  test('MOB-28 la hoja trae la cuenta elegida en Inicio con titular, banco, cuenta y CLABE agrupada', async () => {
    const { sheet } = await openSheet();

    expect(sheet.getByText('Recibir dinero')).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Principal' })).toBeSelected();
    expect(sheet.getByText(me.fullName)).toBeOnTheScreen();
    expect(sheet.getByText('TreoWallet')).toBeOnTheScreen();
    expect(sheet.getByText(grouped(principal.clabe))).toBeOnTheScreen();
    expect(
      sheet.getByText('Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.'),
    ).toBeOnTheScreen();
  });

  test('MOB-28 cambiar a Ahorro actualiza la cuenta y la CLABE', async () => {
    const { user, sheet } = await openSheet();

    await user.press(sheet.getByRole('button', { name: 'Ahorro' }));

    expect(sheet.getByRole('button', { name: 'Ahorro' })).toBeSelected();
    expect(sheet.getByText(grouped(ahorro.clabe))).toBeOnTheScreen();
    expect(sheet.queryByText(grouped(principal.clabe))).toBeNull();
  });

  test('MOB-28 "Copiar CLABE" copia los 18 dígitos sin espacios y confirma "CLABE copiada"', async () => {
    const { user, sheet } = await openSheet();

    await user.press(sheet.getByRole('button', { name: 'Copiar CLABE' }));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(principal.clabe);
    expect(principal.clabe).toMatch(/^\d{18}$/);
    expect(await sheet.findByRole('button', { name: 'CLABE copiada' })).toBeOnTheScreen();
    // Al cambiar de cuenta el aviso ya no aplica a la CLABE que se ve.
    await user.press(sheet.getByRole('button', { name: 'Ahorro' }));
    expect(sheet.getByRole('button', { name: 'Copiar CLABE' })).toBeOnTheScreen();
  });

  test('MOB-28 "Compartir" abre la hoja nativa con los mismos datos', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    const { user, sheet } = await openSheet();

    await user.press(sheet.getByRole('button', { name: 'Compartir' }));

    expect(share).toHaveBeenCalledWith({
      message: [
        `Titular: ${me.fullName}`,
        'Banco: TreoWallet',
        'Cuenta: Principal',
        `CLABE: ${principal.clabe}`,
      ].join('\n'),
    });
  });

  test('MOB-19 las tarjetas de cuenta solo muestran la CLABE enmascarada', async () => {
    await renderApp({ fake: homeApi(), routes });
    await screen.findByText('$25,000.00');
    expect(screen.queryByText(principal.clabe)).toBeNull();
    expect(screen.queryByText(grouped(principal.clabe))).toBeNull();
    expect(screen.queryByRole('button', { name: /Mostrar CLABE/ })).toBeNull();
  });
});
