import type { TokenPair } from '@devchrisvaz/wallet-contract';
import * as SecureStore from 'expo-secure-store';

import { createServices } from '@/app-services';
import { createFakeApi } from '@/test-utils/fake-api';
import { secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_BASE_URL } from '@/test-utils/render-app';

import { REFRESH_TOKEN_KEY, Session } from '../session';
import {
  clearUnlockPreference,
  readUnlockPreference,
  saveUnlockPreference,
  UNLOCK_PREFERENCE_KEY,
  UnlockPreferenceStore,
  type UnlockPreference,
} from '../unlock-preference';

const tokens: TokenPair = {
  tokenType: 'Bearer',
  accessToken: `access-1-${'a'.repeat(40)}`,
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: `refresh-1-${'r'.repeat(40)}`,
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

describe('preferencia del desbloqueo biométrico', () => {
  test('MOB-24 sin respuesta guardada, la preferencia está vacía', async () => {
    expect(await readUnlockPreference()).toBeNull();
  });

  test('MOB-24 guarda "enabled" o "declined" en el almacenamiento seguro, solo en este dispositivo', async () => {
    await saveUnlockPreference('enabled');
    expect(secureStoreMock.entries()).toEqual({ [UNLOCK_PREFERENCE_KEY]: 'enabled' });
    expect(await readUnlockPreference()).toBe('enabled');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(UNLOCK_PREFERENCE_KEY, 'enabled', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    await saveUnlockPreference('declined');
    expect(await readUnlockPreference()).toBe('declined');

    await clearUnlockPreference();
    expect(secureStoreMock.entries()).toEqual({});
    expect(await readUnlockPreference()).toBeNull();
  });

  test('MOB-24 la preferencia nunca contiene un token', async () => {
    const session = new Session();
    await session.start(tokens);
    for (const value of ['enabled', 'declined'] as const) {
      await saveUnlockPreference(value);
      const stored = secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY];
      expect(stored).toBe(value);
      expect(stored).not.toContain(tokens.accessToken);
      expect(stored).not.toContain(tokens.refreshToken);
    }
    // Solo se escriben los dos valores conocidos, aunque el tipo se fuerce.
    await expect(saveUnlockPreference(tokens.refreshToken as UnlockPreference)).rejects.toThrow();
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBe('declined');
  });

  test('MOB-24 un valor desconocido en el almacenamiento se lee como vacío', async () => {
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'otro-valor');
    expect(await readUnlockPreference()).toBeNull();
  });

  test('MOB-24 si el almacenamiento seguro falla al leer, la preferencia se lee como vacía', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error('Keystore no disponible'));
    expect(await readUnlockPreference()).toBeNull();
  });

  test('MOB-27 limpiar la sesión borra la preferencia junto con el refresh token', async () => {
    const session = new Session();
    await session.start(tokens);
    await saveUnlockPreference('enabled');

    await session.clear('revoked');

    expect(secureStoreMock.entries()).toEqual({});
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(UNLOCK_PREFERENCE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  test('MOB-24 la copia en memoria refleja lo guardado y avisa de cada cambio', async () => {
    const store = new UnlockPreferenceStore();
    const listener = jest.fn();
    store.subscribe(listener);
    expect(store.getSnapshot()).toBeUndefined();

    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'declined');
    expect(await store.load()).toBe('declined');
    expect(store.getSnapshot()).toBe('declined');

    await store.save('enabled');
    expect(store.getSnapshot()).toBe('enabled');
    expect(secureStoreMock.entries()).toEqual({ [UNLOCK_PREFERENCE_KEY]: 'enabled' });

    await store.clear();
    expect(store.getSnapshot()).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(3);
  });

  test('MOB-27 al cerrar la sesión la copia en memoria de la preferencia también se vacía', async () => {
    const services = createServices(TEST_BASE_URL, createFakeApi().fetch, { testing: true });
    await services.session.start(tokens);
    await services.unlockPreference.save('enabled');

    await services.session.clear('logout');

    expect(services.unlockPreference.getSnapshot()).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
  });
});
