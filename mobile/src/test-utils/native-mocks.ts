/**
 * Acceso de las pruebas a las simulaciones de `__mocks__/` (expo-secure-store y NetInfo).
 */
import * as NetInfoModule from '@react-native-community/netinfo';
import * as SecureStoreModule from 'expo-secure-store';

interface SecureStoreInternals {
  __store: Map<string, string>;
}

interface NetInfoInternals {
  __setConnected(isConnected: boolean): void;
  __reset(): void;
  __listenerCount(): number;
}

const secureStore = SecureStoreModule as unknown as typeof SecureStoreModule & SecureStoreInternals;
const netInfo = NetInfoModule as unknown as NetInfoInternals;

export const secureStoreMock = {
  /** Contenido actual del almacenamiento seguro simulado. */
  entries(): Record<string, string> {
    return Object.fromEntries(secureStore.__store);
  },
  reset(): void {
    secureStore.__store.clear();
    jest.mocked(secureStore.setItemAsync).mockClear();
    jest.mocked(secureStore.getItemAsync).mockClear();
    jest.mocked(secureStore.deleteItemAsync).mockClear();
  },
};

export const netInfoMock = {
  setConnected(isConnected: boolean): void {
    netInfo.__setConnected(isConnected);
  },
  listenerCount(): number {
    return netInfo.__listenerCount();
  },
  reset(): void {
    netInfo.__reset();
  },
};
