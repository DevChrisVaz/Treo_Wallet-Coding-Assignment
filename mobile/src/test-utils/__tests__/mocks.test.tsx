import NetInfo from '@react-native-community/netinfo';
import { render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { AppState, Text } from 'react-native';

import { mockAppState } from '../app-state';
import { localAuthMock, netInfoMock, secureStoreMock } from '../native-mocks';

describe('entorno de pruebas', () => {
  test('MOB-02 el almacenamiento seguro simulado guarda con sus opciones y empieza vacío', async () => {
    expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
    await SecureStore.setItemAsync('refreshToken', 'r1', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(await SecureStore.getItemAsync('refreshToken')).toBe('r1');
    expect(secureStoreMock.entries()).toEqual({ refreshToken: 'r1' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'r1', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync('refreshToken');
    expect(secureStoreMock.entries()).toEqual({});
    // Se deja un valor guardado para comprobar en la siguiente prueba que se limpia.
    await SecureStore.setItemAsync('refreshToken', 'r2');
  });

  test('MOB-02 cada prueba empieza con el almacenamiento seguro vacío', () => {
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-10 NetInfo simulado entrega el estado al suscribirse y emite los cambios', () => {
    const states: (boolean | null)[] = [];
    const unsubscribe = NetInfo.addEventListener((state) => states.push(state.isConnected));
    netInfoMock.setConnected(false);
    netInfoMock.setConnected(true);
    unsubscribe();
    netInfoMock.setConnected(false);
    expect(states).toEqual([true, false, true]);
  });

  test('MOB-16 AppState simulado notifica los cambios de estado', () => {
    const appState = mockAppState();
    const states: string[] = [];
    const subscription = AppState.addEventListener('change', (state) => states.push(state));
    appState.emit('inactive');
    appState.emit('background');
    subscription.remove();
    appState.emit('active');
    expect(states).toEqual(['inactive', 'background']);
    expect(AppState.currentState).toBe('active');
  });

  test('MOB-24 la biometría simulada empieza con una huella registrada y un diálogo exitoso', async () => {
    expect(await LocalAuthentication.hasHardwareAsync()).toBe(true);
    expect(await LocalAuthentication.isEnrolledAsync()).toBe(true);
    expect(await LocalAuthentication.supportedAuthenticationTypesAsync()).toEqual([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    expect(await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquea' })).toEqual({
      success: true,
    });
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Desbloquea',
    });
    // Se deja otra configuración para comprobar en la siguiente prueba que se restablece.
    localAuthMock.configure({ hasHardware: false, enrolled: false, types: [] });
    localAuthMock.onAuthenticate({ success: false, error: 'lockout' });
  });

  test('MOB-24 cada prueba empieza con la biometría simulada restablecida', async () => {
    expect(await LocalAuthentication.hasHardwareAsync()).toBe(true);
    expect(await LocalAuthentication.isEnrolledAsync()).toBe(true);
    expect(await LocalAuthentication.authenticateAsync()).toEqual({ success: true });
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('MOB-24 se configuran el hardware, el registro, el tipo y las respuestas del diálogo', async () => {
    localAuthMock.configure({
      enrolled: false,
      types: [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION],
    });
    expect(await LocalAuthentication.hasHardwareAsync()).toBe(true);
    expect(await LocalAuthentication.isEnrolledAsync()).toBe(false);
    expect(await LocalAuthentication.supportedAuthenticationTypesAsync()).toEqual([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);

    let finish: (result: LocalAuthentication.LocalAuthenticationResult) => void = () => {};
    localAuthMock.onAuthenticate(
      { success: false, error: 'user_cancel' },
      () => new Promise((resolve) => (finish = resolve)),
      { success: true },
    );
    expect(await LocalAuthentication.authenticateAsync()).toEqual({
      success: false,
      error: 'user_cancel',
    });
    const pending = LocalAuthentication.authenticateAsync();
    finish({ success: false, error: 'lockout' });
    expect(await pending).toEqual({ success: false, error: 'lockout' });
    // La última respuesta se repite.
    expect(await LocalAuthentication.authenticateAsync()).toEqual({ success: true });
    expect(await LocalAuthentication.authenticateAsync()).toEqual({ success: true });
  });

  test('MOB-17 Testing Library renderiza componentes de React Native', async () => {
    await render(<Text>TreoWallet</Text>);
    expect(screen.getByText('TreoWallet')).toBeOnTheScreen();
  });
});
