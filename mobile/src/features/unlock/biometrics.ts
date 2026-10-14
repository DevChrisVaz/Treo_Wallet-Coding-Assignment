/**
 * Biometría del dispositivo con `expo-local-authentication` (diseño D1). El diálogo del sistema
 * acepta como alternativa la credencial del dispositivo: PIN, patrón o contraseña (MOB-26).
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type UnlockResult = 'success' | 'error';

const PROMPT: LocalAuthentication.LocalAuthenticationOptions = {
  promptMessage: 'Desbloquea TreoWallet',
  cancelLabel: 'Cancelar',
  disableDeviceFallback: false,
};

/** Abre el diálogo biométrico del sistema. */
export async function requestUnlock(): Promise<UnlockResult> {
  const result = await LocalAuthentication.authenticateAsync(PROMPT);
  return result.success ? 'success' : 'error';
}
