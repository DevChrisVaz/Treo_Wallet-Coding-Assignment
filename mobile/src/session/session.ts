/**
 * Sesión de la app (MOB-02). El refresh token vive solo en el almacenamiento seguro del sistema
 * operativo (Keychain/Keystore), accesible únicamente con el dispositivo desbloqueado y sin viajar
 * en respaldos; el access token vive solo en memoria. Ningún token se escribe en otro lado ni en
 * los logs.
 */
import type { TokenPair } from '@devchrisvaz/wallet-contract';
import * as SecureStore from 'expo-secure-store';

export const REFRESH_TOKEN_KEY = 'treowallet.refreshToken';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type SignOutReason = 'logout' | 'revoked';

export type SessionSnapshot =
  { status: 'unknown' } | { status: 'signedIn' } | { status: 'signedOut'; reason?: SignOutReason };

type Listener = () => void;

export class Session {
  private accessToken: string | undefined;
  private snapshot: SessionSnapshot = { status: 'unknown' };
  private readonly listeners = new Set<Listener>();

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /** Estado para la interfaz; cambia de identidad solo cuando cambia la sesión. */
  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async readRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_OPTIONS);
    } catch {
      return null;
    }
  }

  /** Inicio de sesión exitoso. */
  async start(tokens: TokenPair): Promise<void> {
    await this.replaceTokens(tokens);
    this.setSnapshot({ status: 'signedIn' });
  }

  /**
   * Guarda el refresh nuevo antes de usar el access nuevo: si la app se cierra entre ambos pasos,
   * el siguiente arranque renueva con el refresh vigente. Si la escritura falla, la sesión sigue en
   * memoria y el siguiente arranque pedirá credenciales.
   */
  async replaceTokens(tokens: TokenPair): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken, SECURE_OPTIONS);
    } catch {
      console.warn('No se pudo guardar la sesión en el almacenamiento seguro.');
      // El refresh anterior ya se usó: reutilizarlo al arrancar revocaría la familia en la API.
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, SECURE_OPTIONS).catch(() => undefined);
    }
    this.accessToken = tokens.accessToken;
  }

  /** Borra los tokens locales (memoria y almacenamiento seguro). */
  async clear(reason: SignOutReason): Promise<void> {
    this.accessToken = undefined;
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, SECURE_OPTIONS);
    } catch {
      console.warn('No se pudo borrar la sesión del almacenamiento seguro.');
    }
    this.setSnapshot({ status: 'signedOut', reason });
  }

  /** Arranque sin sesión guardada o restaurada. */
  markSignedOut(): void {
    this.setSnapshot({ status: 'signedOut' });
  }

  markSignedIn(): void {
    this.setSnapshot({ status: 'signedIn' });
  }

  private setSnapshot(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
