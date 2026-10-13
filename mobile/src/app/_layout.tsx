import { Stack } from 'expo-router';

import { readApiUrl } from '@/config/api-url';
import { ConfigGate } from '@/config/config-gate';

// Se lee una vez al arrancar: Expo incorpora EXPO_PUBLIC_API_URL al bundle.
const apiUrl = readApiUrl();

export default function RootLayout() {
  return <ConfigGate config={apiUrl}>{() => <Stack />}</ConfigGate>;
}
