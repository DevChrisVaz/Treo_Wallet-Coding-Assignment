import NetInfo from '@react-native-community/netinfo';

import type { Connectivity } from './transfer-attempt';

/** Conectividad del dispositivo según NetInfo, que avisa el estado actual al suscribirse. */
export const netInfoConnectivity: Connectivity = {
  subscribe(listener) {
    return NetInfo.addEventListener((state) => listener(state.isConnected === true));
  },
};
