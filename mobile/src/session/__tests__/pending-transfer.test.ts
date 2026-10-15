import type { TokenPair } from '@devchrisvaz/wallet-contract';
import * as SecureStore from 'expo-secure-store';

import { secureStoreMock } from '@/test-utils/native-mocks';

import {
  clearPendingTransfer,
  loadPendingTransfer,
  PENDING_TRANSFER_KEY,
  PENDING_TRANSFER_TTL_MS,
  savePendingTransfer,
  type PendingTransfer,
} from '../pending-transfer';
import { Session } from '../session';

const pending: PendingTransfer = {
  key: 'b6f1c6a2-3d4e-4f50-8a61-72b3c4d5e6f7',
  payload: '{"amount":"1250"}',
  draft: {
    fromAccountId: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
    beneficiaryId: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
    amount: '1250',
    concept: 'Renta',
    reference: '1',
  },
};

const tokens: TokenPair = {
  tokenType: 'Bearer',
  accessToken: `access-1-${'a'.repeat(40)}`,
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: `refresh-1-${'r'.repeat(40)}`,
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

describe('transferencia en vuelo guardada', () => {
  test('MOB-11 guarda la llave, el payload y el borrador en el almacenamiento seguro, solo en este dispositivo', async () => {
    await savePendingTransfer(pending, () => 1_000);

    expect(Object.keys(secureStoreMock.entries())).toEqual([PENDING_TRANSFER_KEY]);
    expect(JSON.parse(secureStoreMock.entries()[PENDING_TRANSFER_KEY] ?? '')).toEqual({
      ...pending,
      savedAt: 1_000,
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      PENDING_TRANSFER_KEY,
      expect.any(String),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
    expect(await loadPendingTransfer(() => 2_000)).toEqual(pending);
  });

  test('MOB-11 un intento de más de 24 horas se descarta y se borra', async () => {
    await savePendingTransfer(pending, () => 0);

    expect(await loadPendingTransfer(() => PENDING_TRANSFER_TTL_MS - 1)).toEqual(pending);
    expect(await loadPendingTransfer(() => PENDING_TRANSFER_TTL_MS)).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-11 un registro dañado se ignora y se borra', async () => {
    secureStoreMock.set(PENDING_TRANSFER_KEY, '{"key":"x"');
    expect(await loadPendingTransfer()).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});

    secureStoreMock.set(PENDING_TRANSFER_KEY, JSON.stringify({ key: 'x', payload: 1 }));
    expect(await loadPendingTransfer()).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-11 si el almacenamiento falla, guardar no rompe el envío y leer cuenta como vacío', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('keystore'));
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keystore'));

    await expect(savePendingTransfer(pending)).resolves.toBeUndefined();
    expect(await loadPendingTransfer()).toBeNull();
    warn.mockRestore();
  });

  test('MOB-11 cerrar sesión borra el intento guardado', async () => {
    const session = new Session();
    await session.start(tokens);
    await savePendingTransfer(pending);

    await session.clear('logout');

    expect(await loadPendingTransfer()).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-11 una sesión revocada también lo borra', async () => {
    const session = new Session();
    await session.start(tokens);
    await savePendingTransfer(pending);

    await session.clear('revoked');

    expect(await loadPendingTransfer()).toBeNull();
  });

  test('MOB-11 una sesión nueva no hereda el intento de la anterior', async () => {
    await savePendingTransfer(pending);

    await new Session().start(tokens);

    expect(await loadPendingTransfer()).toBeNull();
  });

  test('MOB-11 borrar sin intento guardado no falla', async () => {
    await expect(clearPendingTransfer()).resolves.toBeUndefined();
  });
});
