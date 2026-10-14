/**
 * Renderiza la raíz de la app como `app/_layout.tsx` (pantalla de privacidad, servicios, puerta de
 * desbloqueo y navegación raíz) con la API simulada y las pantallas reales de inicio de sesión y de
 * saldo. La sesión arranca como en el dispositivo: desde lo guardado en el
 * almacenamiento seguro simulado.
 */
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import { AppProviders, createServices } from '@/app-services';
import { PrivacyGuard } from '@/components/privacy-guard';
import { HomeScreen } from '@/features/accounts/home-screen';
import { LoginScreen } from '@/features/auth/login-screen';
import { UnlockGate } from '@/features/unlock/unlock-gate';
import { RootNavigator } from '@/navigation/root-navigator';

import type { FakeApi } from './fake-api';
import { TEST_BASE_URL } from './render-app';

interface RenderRootOptions {
  fake: FakeApi;
}

export async function renderRoot({ fake }: RenderRootOptions) {
  const services = createServices(TEST_BASE_URL, fake.fetch, { testing: true });
  const router = renderRouter(
    {
      _layout: () => (
        <PrivacyGuard>
          <AppProviders baseUrl={TEST_BASE_URL} services={services}>
            <UnlockGate>
              <RootNavigator />
            </UnlockGate>
          </AppProviders>
        </PrivacyGuard>
      ),
      login: LoginScreen,
      '(app)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
      '(app)/index': HomeScreen,
    },
    { initialUrl: '/' },
  );
  await router;
  return { services, router };
}
