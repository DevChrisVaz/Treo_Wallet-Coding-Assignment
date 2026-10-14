/**
 * Simulación en memoria de expo-secure-store (Keychain/Keystore). Las pruebas inspeccionan lo
 * guardado con `secureStoreMock` de `src/test-utils/native-mocks`.
 */
import type { SecureStoreOptions } from 'expo-secure-store';

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

export const __store = new Map<string, string>();

export const isAvailableAsync = jest.fn(async () => true);

export const setItemAsync = jest.fn(
  async (key: string, value: string, _options?: SecureStoreOptions): Promise<void> => {
    __store.set(key, value);
  },
);

export const getItemAsync = jest.fn(
  async (key: string, _options?: SecureStoreOptions): Promise<string | null> =>
    __store.get(key) ?? null,
);

export const deleteItemAsync = jest.fn(
  async (key: string, _options?: SecureStoreOptions): Promise<void> => {
    __store.delete(key);
  },
);
