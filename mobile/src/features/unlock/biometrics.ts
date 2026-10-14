/**
 * Biometría del dispositivo con `expo-local-authentication` (diseño D1). El diálogo del sistema
 * acepta como alternativa la credencial del dispositivo: PIN, patrón o contraseña (MOB-26).
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const { AuthenticationType } = LocalAuthentication;

/** Nombre del tipo de biometría en los textos: "huella", "rostro" o "biometría". */
export type BiometricKind = 'huella' | 'rostro' | 'biometría';

export interface BiometricSupport {
  /** Hay hardware biométrico con al menos una biometría registrada. */
  available: boolean;
  kind: BiometricKind;
}

/**
 * Resultado del diálogo traducido según el diseño (D5): `cancelled` deja la pantalla como está,
 * `lockout` es el bloqueo temporal del sistema, `unavailable` significa que ya no hay biometría
 * registrada, credencial o hardware, y `error` es cualquier otro fallo.
 */
export type UnlockResult = 'success' | 'cancelled' | 'lockout' | 'unavailable' | 'error';

const PROMPT_OPTIONS: LocalAuthentication.LocalAuthenticationOptions = {
  // Android solo muestra esta etiqueta si no se permite la credencial del dispositivo.
  cancelLabel: 'Cancelar',
  disableDeviceFallback: false,
};

const RESULTS: Partial<Record<LocalAuthentication.LocalAuthenticationError, UnlockResult>> = {
  user_cancel: 'cancelled',
  system_cancel: 'cancelled',
  app_cancel: 'cancelled',
  lockout: 'lockout',
  not_enrolled: 'unavailable',
  passcode_not_set: 'unavailable',
  // Android informa así la falta de hardware o de biometría registrada.
  not_available: 'unavailable',
};

/**
 * Con un solo tipo, su nombre; con varios (un teléfono con huella y rostro) o ninguno, el genérico:
 * el sistema decide cuál pide y el hardware no dice cuál está registrado.
 */
function kindFor(types: LocalAuthentication.AuthenticationType[]): BiometricKind {
  if (types.length !== 1) return 'biometría';
  if (types[0] === AuthenticationType.FINGERPRINT) return 'huella';
  if (types[0] === AuthenticationType.FACIAL_RECOGNITION) return 'rostro';
  return 'biometría';
}

async function isAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

export async function readBiometricSupport(): Promise<BiometricSupport> {
  try {
    const [available, types] = await Promise.all([
      isAvailable(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return { available, kind: kindFor(types) };
  } catch {
    return { available: false, kind: 'biometría' };
  }
}

/**
 * Lee la biometría del dispositivo al montar y cada vez que la app vuelve a estar activa, por
 * ejemplo después de registrar una huella en los ajustes del teléfono; `null` mientras la lee.
 */
export function useBiometricSupport(): BiometricSupport | null {
  const [support, setSupport] = useState<BiometricSupport | null>(null);

  useEffect(() => {
    let active = true;
    const read = () => {
      void readBiometricSupport().then((value) => {
        if (active) setSupport(value);
      });
    };
    read();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return support;
}

/**
 * Abre el diálogo biométrico del sistema. Antes comprueba que siga habiendo biometría registrada:
 * en Android, sin huellas pero con PIN, el diálogo caería a la credencial del dispositivo y el
 * desbloqueo seguiría activo aunque la persona retiró sus huellas (MOB-26).
 */
export async function requestUnlock(
  promptMessage = 'Desbloquea TreoWallet',
): Promise<UnlockResult> {
  try {
    if (!(await isAvailable())) return 'unavailable';
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      ...PROMPT_OPTIONS,
    });
    if (result.success) return 'success';
    return RESULTS[result.error] ?? 'error';
  } catch {
    return 'error';
  }
}
