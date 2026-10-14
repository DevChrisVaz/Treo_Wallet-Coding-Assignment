/**
 * Preferencia del desbloqueo biométrico (MOB-24, diseño D3): `enabled` (activo), `declined` (la
 * persona respondió "Ahora no") o vacía (no se le ha preguntado). No es un secreto, pero vive en el
 * mismo almacenamiento seguro que el refresh token para compartir su ciclo de vida: la sesión la
 * borra al cerrarse o al quedar revocada (MOB-27). Nunca guarda tokens ni datos biométricos.
 */
import * as SecureStore from 'expo-secure-store';

export const UNLOCK_PREFERENCE_KEY = 'treowallet.biometricUnlock';

export type UnlockPreference = 'enabled' | 'declined';

const VALUES: readonly string[] = ['enabled', 'declined'] satisfies UnlockPreference[];

// Las mismas opciones que el refresh token: solo con el dispositivo desbloqueado y sin respaldos.
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function isUnlockPreference(value: string | null): value is UnlockPreference {
  return value !== null && VALUES.includes(value);
}

/** La respuesta guardada; un valor desconocido o un fallo del almacenamiento cuentan como vacía. */
export async function readUnlockPreference(): Promise<UnlockPreference | null> {
  try {
    const stored = await SecureStore.getItemAsync(UNLOCK_PREFERENCE_KEY, SECURE_OPTIONS);
    return isUnlockPreference(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Guarda la respuesta. Si el almacenamiento falla, el error llega a quien la guardó. */
export async function saveUnlockPreference(value: UnlockPreference): Promise<void> {
  if (!isUnlockPreference(value)) throw new Error('Preferencia de desbloqueo desconocida');
  await SecureStore.setItemAsync(UNLOCK_PREFERENCE_KEY, value, SECURE_OPTIONS);
}

export async function clearUnlockPreference(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(UNLOCK_PREFERENCE_KEY, SECURE_OPTIONS);
  } catch {
    console.warn('No se pudo borrar la preferencia de desbloqueo del almacenamiento seguro.');
  }
}
