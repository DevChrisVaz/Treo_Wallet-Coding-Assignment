import type { TokenPair } from '@devchrisvaz/wallet-contract';
import * as SecureStore from 'expo-secure-store';

import { secureStoreMock } from '@/test-utils/native-mocks';

import { REFRESH_TOKEN_KEY, Session } from '../session';

const tokens = (n: number): TokenPair => ({
  tokenType: 'Bearer',
  accessToken: `access-${n}-${'a'.repeat(40)}`,
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: `refresh-${n}-${'r'.repeat(40)}`,
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
});

function spyConsole() {
  return (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation(() => {}),
  );
}

describe('sesión y almacenamiento de tokens', () => {
  test('MOB-02 al iniciar sesión el refresh token queda en el almacenamiento seguro, solo en este dispositivo', async () => {
    const session = new Session();
    await session.start(tokens(1));
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: tokens(1).refreshToken });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      REFRESH_TOKEN_KEY,
      tokens(1).refreshToken,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  test('MOB-02 el access token solo vive en memoria y no se escribe en ningún almacenamiento', async () => {
    const session = new Session();
    await session.start(tokens(1));
    expect(session.getAccessToken()).toBe(tokens(1).accessToken);
    const written = jest.mocked(SecureStore.setItemAsync).mock.calls.map(([, value]) => value);
    expect(written).not.toContain(tokens(1).accessToken);
    expect(JSON.stringify(secureStoreMock.entries())).not.toContain(tokens(1).accessToken);
    expect(session.getSnapshot()).toEqual({ status: 'signedIn' });
  });

  test('MOB-02 al renovar se guarda primero el refresh nuevo y después se usa el access nuevo', async () => {
    const session = new Session();
    await session.start(tokens(1));
    let accessDuringWrite: string | undefined;
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (key, value) => {
      accessDuringWrite = session.getAccessToken();
      secureStoreMock.set(key, value);
    });
    await session.replaceTokens(tokens(2));
    expect(accessDuringWrite).toBe(tokens(1).accessToken);
    expect(session.getAccessToken()).toBe(tokens(2).accessToken);
    expect(await session.readRefreshToken()).toBe(tokens(2).refreshToken);
  });

  test('MOB-02 si el almacenamiento seguro falla, la sesión sigue solo en memoria', async () => {
    jest
      .mocked(SecureStore.setItemAsync)
      .mockRejectedValueOnce(new Error('Keychain no disponible'));
    const session = new Session();
    await session.start(tokens(1));
    expect(session.getAccessToken()).toBe(tokens(1).accessToken);
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-02 si falla guardar el refresh renovado, se borra el anterior (ya usado) para no reutilizarlo', async () => {
    const session = new Session();
    await session.start(tokens(1));
    jest
      .mocked(SecureStore.setItemAsync)
      .mockRejectedValueOnce(new Error('Keychain no disponible'));
    await session.replaceTokens(tokens(2));
    expect(session.getAccessToken()).toBe(tokens(2).accessToken);
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-02 al limpiar la sesión se borran el refresh guardado y el access en memoria', async () => {
    const session = new Session();
    await session.start(tokens(1));
    await session.clear('revoked');
    expect(secureStoreMock.entries()).toEqual({});
    expect(session.getAccessToken()).toBeUndefined();
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'revoked' });
  });

  test('MOB-02 ningún token aparece en los logs', async () => {
    const spies = spyConsole();
    jest
      .mocked(SecureStore.setItemAsync)
      .mockRejectedValueOnce(new Error('Keychain no disponible'));
    const session = new Session();
    await session.start(tokens(1));
    await session.replaceTokens(tokens(2));
    await session.clear('logout');
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const pair of [tokens(1), tokens(2)]) {
      expect(logged).not.toContain(pair.accessToken);
      expect(logged).not.toContain(pair.refreshToken);
    }
  });

  test('MOB-02 notifica a los suscriptores los cambios de sesión', async () => {
    const session = new Session();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);
    await session.start(tokens(1));
    await session.clear('logout');
    unsubscribe();
    await session.start(tokens(2));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
