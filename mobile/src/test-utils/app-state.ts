/**
 * AppState controlable para las pruebas. El preset de React Native ya lo sustituye por funciones
 * simuladas sin comportamiento; aquí se les da uno: guardar los suscriptores y notificarles.
 */
import { AppState, type AppStateStatus } from 'react-native';

type Listener = (state: AppStateStatus) => void;

const listeners = new Set<Listener>();

function setCurrentState(state: AppStateStatus): void {
  (AppState as { currentState: AppStateStatus }).currentState = state;
}

export function resetAppState(initial: AppStateStatus = 'active'): void {
  listeners.clear();
  setCurrentState(initial);
  jest.mocked(AppState.addEventListener).mockImplementation((type, listener) => {
    if (type === 'change') listeners.add(listener as Listener);
    return {
      remove: () => {
        listeners.delete(listener as Listener);
      },
    };
  });
}

/** Devuelve un control para emitir cambios de estado, como lo haría el sistema operativo. */
export function mockAppState(initial: AppStateStatus = 'active') {
  resetAppState(initial);
  return {
    emit(state: AppStateStatus): void {
      setCurrentState(state);
      [...listeners].forEach((listener) => listener(state));
    },
    listenerCount: () => listeners.size,
  };
}
