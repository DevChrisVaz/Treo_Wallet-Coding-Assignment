/**
 * Simulación de NetInfo. Igual que la librería, entrega el último estado al suscribirse y después
 * cada cambio. Las pruebas cambian la conexión con `netInfoMock` de `src/test-utils/native-mocks`.
 */
import type { NetInfoState } from '@react-native-community/netinfo';

type Handler = (state: NetInfoState) => void;

const handlers = new Set<Handler>();

function stateFor(isConnected: boolean): NetInfoState {
  return (
    isConnected
      ? { type: 'wifi', isConnected: true, isInternetReachable: true, details: {} }
      : { type: 'none', isConnected: false, isInternetReachable: false, details: null }
  ) as NetInfoState;
}

let latest = stateFor(true);

export function __setConnected(isConnected: boolean): void {
  latest = stateFor(isConnected);
  [...handlers].forEach((handler) => handler(latest));
}

export function __reset(): void {
  handlers.clear();
  latest = stateFor(true);
}

export function __listenerCount(): number {
  return handlers.size;
}

export function addEventListener(handler: Handler): () => void {
  handlers.add(handler);
  handler(latest);
  return () => {
    handlers.delete(handler);
  };
}

export async function fetch(): Promise<NetInfoState> {
  return latest;
}

export async function refresh(): Promise<NetInfoState> {
  return latest;
}

export function configure(): void {}

export default { addEventListener, fetch, refresh, configure };
