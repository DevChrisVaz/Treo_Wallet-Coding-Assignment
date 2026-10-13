import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { readApiUrl } from '@/config/api-url';
import { ConfigGate } from '@/config/config-gate';
import { FontsGate } from '@/theme/fonts';

// La pantalla de carga de Expo se mantiene hasta que Work Sans carga (DSG-05).
void SplashScreen.preventAutoHideAsync();

// Se lee una vez al arrancar: Expo incorpora EXPO_PUBLIC_API_URL al bundle.
const apiUrl = readApiUrl();

export default function RootLayout() {
  return (
    <FontsGate>
      <ConfigGate config={apiUrl}>{() => <Stack />}</ConfigGate>
    </FontsGate>
  );
}
