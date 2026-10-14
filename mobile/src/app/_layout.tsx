import * as SplashScreen from 'expo-splash-screen';

import { AppProviders } from '@/app-services';
import { PrivacyGuard } from '@/components/privacy-guard';
import { readApiUrl } from '@/config/api-url';
import { ConfigGate } from '@/config/config-gate';
import { UnlockGate } from '@/features/unlock/unlock-gate';
import { RootNavigator } from '@/navigation/root-navigator';
import { FontsGate } from '@/theme/fonts';

// La pantalla de carga de Expo se mantiene hasta que Work Sans carga (DSG-05).
void SplashScreen.preventAutoHideAsync();

// Se lee una vez al arrancar: Expo incorpora EXPO_PUBLIC_API_URL al bundle.
const apiUrl = readApiUrl();

export default function RootLayout() {
  return (
    <FontsGate>
      <PrivacyGuard>
        <ConfigGate config={apiUrl}>
          {(baseUrl) => (
            <AppProviders baseUrl={baseUrl}>
              {/* Con el desbloqueo biométrico activo, la sesión se restaura solo al desbloquear. */}
              <UnlockGate>
                <RootNavigator />
              </UnlockGate>
            </AppProviders>
          )}
        </ConfigGate>
      </PrivacyGuard>
    </FontsGate>
  );
}
