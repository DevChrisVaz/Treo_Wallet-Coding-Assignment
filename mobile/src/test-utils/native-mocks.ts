/**
 * Acceso de las pruebas a las simulaciones de `__mocks__/` (expo-secure-store, NetInfo y
 * expo-local-authentication).
 */
import * as NetInfoModule from '@react-native-community/netinfo';
import * as LocalAuthenticationModule from 'expo-local-authentication';
import type { AuthenticationType, LocalAuthenticationResult } from 'expo-local-authentication';
import * as SecureStoreModule from 'expo-secure-store';

interface SecureStoreInternals {
  __store: Map<string, string>;
}

interface NetInfoInternals {
  __setConnected(isConnected: boolean): void;
  __reset(): void;
  __listenerCount(): number;
}

/** Biometría del dispositivo simulado. */
export interface BiometricDevice {
  hasHardware: boolean;
  enrolled: boolean;
  types: AuthenticationType[];
}

/** Respuesta del diálogo biométrico: inmediata o una promesa que la prueba resuelve. */
export type AuthenticateReply =
  LocalAuthenticationResult | (() => Promise<LocalAuthenticationResult>);

interface LocalAuthenticationInternals {
  __configure(changes: Partial<BiometricDevice>): void;
  __onAuthenticate(...replies: AuthenticateReply[]): void;
  __reset(): void;
}

const secureStore = SecureStoreModule as unknown as typeof SecureStoreModule & SecureStoreInternals;
const netInfo = NetInfoModule as unknown as NetInfoInternals;
const localAuth = LocalAuthenticationModule as unknown as typeof LocalAuthenticationModule &
  LocalAuthenticationInternals;

export const secureStoreMock = {
  /** Contenido actual del almacenamiento seguro simulado. */
  entries(): Record<string, string> {
    return Object.fromEntries(secureStore.__store);
  },
  /** Escribe directo en el almacenamiento simulado, sin pasar por la API simulada. */
  set(key: string, value: string): void {
    secureStore.__store.set(key, value);
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

export const localAuthMock = {
  /** Cambia el hardware, el registro o los tipos de biometría del dispositivo simulado. */
  configure(changes: Partial<BiometricDevice>): void {
    localAuth.__configure(changes);
  },
  /** Respuestas del diálogo biométrico en orden; la última se repite. */
  onAuthenticate(...replies: AuthenticateReply[]): void {
    localAuth.__onAuthenticate(...replies);
  },
  reset(): void {
    localAuth.__reset();
  },
};
