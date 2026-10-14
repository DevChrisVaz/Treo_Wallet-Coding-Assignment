import * as LocalAuthentication from 'expo-local-authentication';
import type { LocalAuthenticationError } from 'expo-local-authentication';

import { localAuthMock } from '@/test-utils/native-mocks';

import { readBiometricSupport, requestUnlock } from '../biometrics';

const { AuthenticationType } = LocalAuthentication;

const failure = (error: LocalAuthenticationError) => ({ success: false as const, error });

describe('biometría del dispositivo', () => {
  test('MOB-26 el diálogo va en español y acepta la credencial del dispositivo', async () => {
    await requestUnlock();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Desbloquea TreoWallet',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });
  });

  test('MOB-25 traduce el éxito y las cancelaciones del diálogo', async () => {
    expect(await requestUnlock()).toBe('success');
    for (const error of ['user_cancel', 'system_cancel', 'app_cancel'] as const) {
      localAuthMock.onAuthenticate(failure(error));
      expect(await requestUnlock()).toBe('cancelled');
    }
  });

  test('MOB-26 traduce el bloqueo temporal del sistema', async () => {
    localAuthMock.onAuthenticate(failure('lockout'));
    expect(await requestUnlock()).toBe('lockout');
  });

  test('MOB-26 sin biometría registrada, sin credencial o sin hardware el desbloqueo deja de estar disponible', async () => {
    for (const error of ['not_enrolled', 'passcode_not_set', 'not_available'] as const) {
      localAuthMock.onAuthenticate(failure(error));
      expect(await requestUnlock()).toBe('unavailable');
    }
  });

  test('MOB-26 si ya no hay biometría registrada no abre el diálogo (Android caería al PIN)', async () => {
    localAuthMock.configure({ enrolled: false });
    expect(await requestUnlock()).toBe('unavailable');
    localAuthMock.configure({ hasHardware: false });
    expect(await requestUnlock()).toBe('unavailable');
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-25 cualquier otro error, o un fallo del módulo, es un error genérico', async () => {
    for (const error of [
      'unknown',
      'timeout',
      'authentication_failed',
      'user_fallback',
      'unable_to_process',
    ] as const) {
      localAuthMock.onAuthenticate(failure(error));
      expect(await requestUnlock()).toBe('error');
    }
    localAuthMock.onAuthenticate(() => Promise.reject(new Error('Sin actividad')));
    expect(await requestUnlock()).toBe('error');
  });

  test('MOB-24 nombra el tipo de biometría: huella, rostro o biometría', async () => {
    expect(await readBiometricSupport()).toEqual({ available: true, kind: 'huella' });

    localAuthMock.configure({ types: [AuthenticationType.FACIAL_RECOGNITION] });
    expect((await readBiometricSupport()).kind).toBe('rostro');

    for (const types of [
      [AuthenticationType.IRIS],
      [AuthenticationType.FINGERPRINT, AuthenticationType.FACIAL_RECOGNITION],
      [],
    ]) {
      localAuthMock.configure({ types });
      expect((await readBiometricSupport()).kind).toBe('biometría');
    }
  });

  test('MOB-24 sin biometría registrada o sin hardware no está disponible', async () => {
    localAuthMock.configure({ enrolled: false });
    expect(await readBiometricSupport()).toEqual({ available: false, kind: 'huella' });
    localAuthMock.configure({ hasHardware: false, types: [] });
    expect(await readBiometricSupport()).toEqual({ available: false, kind: 'biometría' });
  });
});
